'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Product, OrderItem, Order } from '@/types';
import { createPOSOrder } from '@/lib/vendor';
import { Printer, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingRow {
    id: string;
    productId?: string;
    code: string;
    name: string;
    qty: string;
    price: number;
    isProduct: boolean;
}

export interface POSBillingGridProps {
    posProducts: Product[];
    nextPosToken?: number;
    printReceipt?: (order: Partial<Order>, token: string) => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COL_CODE = 0;
const COL_NAME = 1;
const COL_QTY = 2;
const EDITABLE_COLS = [COL_CODE, COL_NAME, COL_QTY];
const DOUBLE_ENTER_MS = 4000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCtr = 0;
const genId = () => `r${++_idCtr}`;

function emptyRow(): BillingRow {
    return { id: genId(), productId: undefined, code: '', name: '', qty: '1', price: 0, isProduct: false };
}

function rowTotal(r: BillingRow): number {
    if (!r.isProduct) return 0;
    return r.price * (parseInt(r.qty) || 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function POSBillingGrid({ posProducts, nextPosToken, printReceipt }: POSBillingGridProps) {
    const [rows, setRows] = useState<BillingRow[]>([emptyRow()]);
    const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({ row: 0, col: COL_CODE });
    const [suggestions, setSuggestions] = useState<Product[]>([]);
    const [suggIdx, setSuggIdx] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmPending, setConfirmPending] = useState(false);
    const [confirmProgress, setConfirmProgress] = useState(0);

    const lastEnterEmptyRef = useRef<number>(0);
    const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

    // ── Derived ───────────────────────────────────────────────────────────────

    const filledRows = useMemo(() => rows.filter(r => r.isProduct && (parseInt(r.qty) || 0) > 0), [rows]);
    const grandTotal = useMemo(() => filledRows.reduce((s, r) => s + rowTotal(r), 0), [filledRows]);
    const hasItems = filledRows.length > 0;

    // ── Refs ──────────────────────────────────────────────────────────────────

    const regRef = useCallback((ri: number, col: number, el: HTMLInputElement | null) => {
        const k = `${ri}:${col}`;
        if (el) inputRefs.current.set(k, el);
        else inputRefs.current.delete(k);
    }, []);

    const focusCell = useCallback((ri: number, col: number, delay = 20) => {
        setTimeout(() => {
            const el = inputRefs.current.get(`${ri}:${col}`);
            if (el) { el.focus(); el.select(); }
        }, delay);
    }, []);

    const isGridFocused = useCallback(() => {
        const active = document.activeElement;
        return Array.from(inputRefs.current.values()).some(el => el === active);
    }, []);

    // ── Global arrow key → focus first empty row ──────────────────────────────

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            if (isGridFocused()) return;
            e.preventDefault();
            const emptyRi = rows.findIndex(r => !r.isProduct && !r.code.trim() && !r.name.trim());
            const targetRi = emptyRi >= 0 ? emptyRi : rows.length - 1;
            setActiveCell({ row: targetRi, col: COL_CODE });
            focusCell(targetRi, COL_CODE, 0);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [rows, isGridFocused, focusCell]);

    // ── Search ────────────────────────────────────────────────────────────────

    const shortcode = useCallback((p: Product) =>
        (p.code ?? p.name.split(/\s+/).map(w => w[0] ?? '').join('')).toLowerCase(), []);

    const doSearch = useCallback((q: string, byCode: boolean): Product[] => {
        const query = q.trim().toLowerCase();
        if (!query) return [];
        if (byCode) {
            if (/^\d+$/.test(query)) {
                const serial = parseInt(query);
                const exact = posProducts.filter(p => p.serialNumber === serial);
                if (exact.length) return exact.slice(0, 1);
            }
            const exact = posProducts.filter(p => shortcode(p) === query);
            if (exact.length) return exact.slice(0, 6);
            return posProducts.filter(p => shortcode(p).startsWith(query)).slice(0, 8);
        }
        const exact = posProducts.filter(p => shortcode(p) === query);
        if (exact.length) return exact.slice(0, 8);
        return posProducts
            .filter(p => shortcode(p).startsWith(query) || p.name.toLowerCase().includes(query))
            .slice(0, 8);
    }, [posProducts, shortcode]);

    // ── Trailing empty row ────────────────────────────────────────────────────

    const ensureTrailingEmpty = useCallback((r: BillingRow[]): BillingRow[] => {
        const last = r[r.length - 1];
        if (!last || last.isProduct || last.code.trim() || last.name.trim()) return [...r, emptyRow()];
        return r;
    }, []);

    // ── Select product ────────────────────────────────────────────────────────

    const selectProduct = useCallback((ri: number, product: Product) => {
        setSuggestions([]);
        setSuggIdx(0);
        setRows(prev => {
            const next = [...prev];
            next[ri] = {
                ...next[ri],
                productId: product.id,
                code: String(product.serialNumber ?? ''),
                name: product.name,
                price: product.price,
                qty: '1',
                isProduct: true,
            };
            return ensureTrailingEmpty(next);
        });
        setActiveCell({ row: ri, col: COL_QTY });
        focusCell(ri, COL_QTY);
    }, [ensureTrailingEmpty, focusCell]);

    // ── Remove row ────────────────────────────────────────────────────────────

    const removeRow = useCallback((ri: number) => {
        setRows(prev => {
            const next = prev.filter((_, i) => i !== ri);
            return ensureTrailingEmpty(next.length ? next : [emptyRow()]);
        });
        setActiveCell(prev => ({ ...prev, row: Math.max(0, prev.row - 1) }));
    }, [ensureTrailingEmpty]);

    // ── Confirm ───────────────────────────────────────────────────────────────

    const handleConfirm = useCallback(async () => {
        if (!hasItems || isSubmitting) return;
        setIsSubmitting(true);
        setConfirmPending(false);
        setConfirmProgress(0);
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

        const orderItems: OrderItem[] = filledRows.map(r => ({
            productId: r.productId!,
            name: r.name,
            price: r.price,
            quantity: parseInt(r.qty) || 1,
            imageURL: posProducts.find(p => p.id === r.productId)?.imageURL ?? '',
        }));

        try {
            const { orderId, posToken } = await createPOSOrder(orderItems, grandTotal, grandTotal, 'Cash', nextPosToken);
            const tokenStr = String(posToken);
            if (printReceipt) {
                const mock: Partial<Order> = {
                    id: orderId, items: orderItems, orderDate: new Date(),
                    status: 'Preparing', orderType: 'pos', payment_status: 'success', grandTotal,
                    orderToken: tokenStr, posToken,
                };
                try {
                    await printReceipt(mock, tokenStr);
                    toast.success(`#${posToken} printed`, { duration: 1200, style: { borderRadius: '12px', fontWeight: 600 } });
                } catch {
                    toast.error('Print failed — order saved');
                }
            } else {
                toast.success(`Token #${posToken} created`, { duration: 1500, style: { borderRadius: '12px', fontWeight: 600 } });
            }
            setRows([emptyRow()]);
            setActiveCell({ row: 0, col: COL_CODE });
            focusCell(0, COL_CODE);
        } catch {
            toast.error('Failed to place order');
        } finally {
            setIsSubmitting(false);
        }
    }, [hasItems, isSubmitting, filledRows, grandTotal, posProducts, printReceipt, focusCell]);

    const triggerConfirmFlow = useCallback(() => {
        if (!hasItems) return;
        if (confirmPending) { handleConfirm(); return; }
        setConfirmPending(true);
        setConfirmProgress(100);
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        const duration = 2000, step = 20;
        let left = duration;
        progressIntervalRef.current = setInterval(() => {
            left -= step;
            setConfirmProgress((left / duration) * 100);
            if (left <= 0) { clearInterval(progressIntervalRef.current!); setConfirmPending(false); }
        }, step);
        confirmTimerRef.current = setTimeout(() => { setConfirmPending(false); setConfirmProgress(0); }, duration);
    }, [hasItems, confirmPending, handleConfirm]);

    // ── Global shortcuts ──────────────────────────────────────────────────────

    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            if (e.key === 'F9') { e.preventDefault(); handleConfirm(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); triggerConfirmFlow(); }
        };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [handleConfirm, triggerConfirmFlow]);

    useEffect(() => { focusCell(0, COL_CODE, 80); }, [focusCell]);

    // ── Per-cell keyboard handler ─────────────────────────────────────────────

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, ri: number, col: number) => {
        const hasSugg = suggestions.length > 0;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (hasSugg) { setSuggIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
            if (ri + 1 < rows.length) { setActiveCell({ row: ri + 1, col }); focusCell(ri + 1, col); }
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (hasSugg) { setSuggIdx(i => Math.max(i - 1, 0)); return; }
            if (ri > 0) { setActiveCell({ row: ri - 1, col }); focusCell(ri - 1, col); }
            return;
        }
        if (e.key === 'ArrowRight' && !hasSugg) {
            e.preventDefault();
            const idx = EDITABLE_COLS.indexOf(col);
            if (idx < EDITABLE_COLS.length - 1) { const nc = EDITABLE_COLS[idx + 1]; setActiveCell({ row: ri, col: nc }); focusCell(ri, nc); }
            return;
        }
        if (e.key === 'ArrowLeft' && !hasSugg) {
            e.preventDefault();
            const idx = EDITABLE_COLS.indexOf(col);
            if (idx > 0) { const nc = EDITABLE_COLS[idx - 1]; setActiveCell({ row: ri, col: nc }); focusCell(ri, nc); }
            return;
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            const idx = EDITABLE_COLS.indexOf(col) + (e.shiftKey ? -1 : 1);
            if (idx >= 0 && idx < EDITABLE_COLS.length) { const nc = EDITABLE_COLS[idx]; setActiveCell({ row: ri, col: nc }); focusCell(ri, nc); }
            else if (!e.shiftKey && ri + 1 < rows.length) { setActiveCell({ row: ri + 1, col: COL_CODE }); focusCell(ri + 1, COL_CODE); }
            else if (e.shiftKey && ri > 0) { setActiveCell({ row: ri - 1, col: COL_QTY }); focusCell(ri - 1, COL_QTY); }
            return;
        }
        if (e.key === 'Escape') { e.preventDefault(); setSuggestions([]); setSuggIdx(0); return; }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (hasSugg && suggestions[suggIdx]) { selectProduct(ri, suggestions[suggIdx]); return; }
            if (col === COL_QTY) {
                const nextRi = ri + 1;
                setRows(prev => ensureTrailingEmpty(prev));
                setActiveCell({ row: nextRi, col: COL_CODE });
                focusCell(nextRi, COL_CODE);
                return;
            }
            const row = rows[ri];
            if (!row.isProduct && !row.code.trim() && !row.name.trim()) {
                const now = Date.now();
                if (now - lastEnterEmptyRef.current < DOUBLE_ENTER_MS && lastEnterEmptyRef.current > 0 && hasItems) {
                    handleConfirm(); lastEnterEmptyRef.current = 0;
                } else { lastEnterEmptyRef.current = now; }
            }
        }
    }, [suggestions, suggIdx, rows, focusCell, selectProduct, ensureTrailingEmpty, handleConfirm, hasItems]);

    // ── Input change handlers ─────────────────────────────────────────────────

    const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, ri: number) => {
        const val = e.target.value;
        setRows(prev => {
            const next = [...prev];
            if (next[ri].isProduct) next[ri] = { ...next[ri], isProduct: false, productId: undefined, price: 0, name: '' };
            next[ri] = { ...next[ri], code: val };
            return next;
        });
        setSuggIdx(0);
        setSuggestions(doSearch(val, true));
    }, [doSearch]);

    const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, ri: number) => {
        const val = e.target.value;
        setRows(prev => {
            const next = [...prev];
            if (next[ri].isProduct) next[ri] = { ...next[ri], isProduct: false, productId: undefined, price: 0, code: '' };
            next[ri] = { ...next[ri], name: val };
            return next;
        });
        setSuggIdx(0);
        setSuggestions(doSearch(val, false));
    }, [doSearch]);

    const handleQtyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, ri: number) => {
        const val = e.target.value.replace(/\D/g, '');
        setRows(prev => { const next = [...prev]; next[ri] = { ...next[ri], qty: val }; return next; });
    }, []);

    // ── Suggestion dropdown ───────────────────────────────────────────────────

    const showSuggAt = (ri: number, col: number) =>
        activeCell.row === ri && activeCell.col === col && suggestions.length > 0;

    const SuggList = ({ ri }: { ri: number }) => (
        <div className="absolute left-0 top-full z-50 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden mt-0.5">
            {suggestions.map((p, idx) => (
                <button
                    key={p.id}
                    onMouseDown={e => { e.preventDefault(); selectProduct(ri, p); }}
                    onMouseEnter={() => setSuggIdx(idx)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left border-b border-slate-100 last:border-0 transition-colors ${idx === suggIdx ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[11px] font-semibold text-slate-300 w-5 shrink-0 text-right tabular-nums">{p.serialNumber ?? ''}</span>
                        <div className="min-w-0">
                            <p className={`text-[13px] font-semibold truncate ${idx === suggIdx ? 'text-indigo-700' : 'text-slate-900'}`}>{p.name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Code: {p.serialNumber ?? shortcode(p)}</p>
                        </div>
                    </div>
                    <span className={`text-[13px] font-bold tabular-nums shrink-0 ml-3 ${idx === suggIdx ? 'text-indigo-600' : 'text-slate-500'}`}>₹{p.price}</span>
                </button>
            ))}
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full bg-slate-100">

            {/* ── Table ── */}
            <div className="flex-1 overflow-auto bg-white">
                <table className="w-full border-separate border-spacing-0 ">

                    {/* HEADER */}
                    <thead className="sticky top-0 z-20 bg-slate-100">
                        <tr className="h-[36px] bg-slate-100">

                            <th className="w-10 border-r border-b border-[#CBD5E1]" />

                            <th className="w-[110px] px-5 text-left border-r border-b border-[#CBD5E1]">
                                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#64748B]">
                                    Code
                                </span>
                            </th>

                            <th className="px-5 text-left border-r border-b border-[#CBD5E1]">
                                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#64748B]">
                                    Item Name
                                </span>
                            </th>

                            <th className="w-[150px] px-4 text-center border-r border-b border-[#CBD5E1]">
                                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#64748B]">
                                    Qty
                                </span>
                            </th>

                            <th className="w-[140px] px-4 text-right border-r border-b border-[#CBD5E1]">
                                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#64748B]">
                                    Price
                                </span>
                            </th>

                            <th className="w-[160px] px-5 text-right border-r border-b border-[#CBD5E1]">
                                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#64748B]">
                                    Total
                                </span>
                            </th>

                            <th className="w-13 border-b border-[#CBD5E1]" />
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((row, ri) => {
                            const isActiveRow = activeCell.row === ri;
                            const isLastRow = ri === rows.length - 1;
                            const total = rowTotal(row);

                            const codeActive = isActiveRow && activeCell.col === COL_CODE;
                            const nameActive = isActiveRow && activeCell.col === COL_NAME;
                            const qtyActive = isActiveRow && activeCell.col === COL_QTY;

                            return (
                                <tr
                                    key={row.id}
                                    className={`
                            h-[45x]
                            bg-white
                            hover:bg-[#FAFBFC]
                            transition-all
                            group
                        `}
                                >

                                    {/* ROW NUMBER */}
                                    <td className="w-10 text-center border-r border-b border-[#CBD5E1]">
                                        <span className={`
                                text-[12px]
                                font-bold
                                tabular-nums
                                ${isActiveRow
                                                ? 'text-[#4F46E5]'
                                                : 'text-[#94A3B8]'
                                            }
                            `}>
                                            {row.isProduct ? ri + 1 : ''}
                                        </span>
                                    </td>

                                    {/* CODE */}
                                    <td className={`
                            border-r
                            border-b
                            border-[#CBD5E1]
                            bg-white
                            relative
                            ${codeActive
                                            ? 'ring-2 ring-inset ring-[#6366F1]'
                                            : ''
                                        }
                        `}>
                                        <div className="h-[45px] flex items-center">
                                            <input
                                                ref={el => regRef(ri, COL_CODE, el)}
                                                type="text"
                                                inputMode="text"
                                                value={row.code}
                                                onChange={e => handleCodeChange(e, ri)}
                                                onKeyDown={e => handleKeyDown(e, ri, COL_CODE)}
                                                onFocus={() => {
                                                    setActiveCell({ row: ri, col: COL_CODE });

                                                    setSuggestions(
                                                        !row.isProduct && row.code
                                                            ? doSearch(row.code, true)
                                                            : []
                                                    );

                                                    setSuggIdx(0);
                                                }}
                                                placeholder={isLastRow ? '#' : ''}
                                                autoComplete="off"
                                                spellCheck={false}
                                                className="
                                        w-full
                                        h-full
                                        px-5
                                        bg-transparent
                                        text-[14px]
                                        font-bold
                                        font-mono
                                        text-[#0F172A]
                                        placeholder:text-[[#CBD5E1]]
                                        focus:outline-none
                                    "
                                            />

                                            {showSuggAt(ri, COL_CODE) && (
                                                <SuggList ri={ri} />
                                            )}
                                        </div>
                                    </td>

                                    {/* ITEM NAME */}
                                    <td className={`
                            border-r
                            border-b
                            border-[#CBD5E1]
                            bg-white
                            relative
                            ${nameActive
                                            ? 'ring-2 ring-inset ring-[#6366F1]'
                                            : ''
                                        }
                        `}>
                                        <div className="h-[45px] flex items-center">
                                            <input
                                                ref={el => regRef(ri, COL_NAME, el)}
                                                type="text"
                                                value={row.name}
                                                onChange={e => handleNameChange(e, ri)}
                                                onKeyDown={e => handleKeyDown(e, ri, COL_NAME)}
                                                onFocus={() => {
                                                    setActiveCell({ row: ri, col: COL_NAME });

                                                    setSuggestions(
                                                        !row.isProduct && row.name
                                                            ? doSearch(row.name, false)
                                                            : []
                                                    );

                                                    setSuggIdx(0);
                                                }}
                                                placeholder={isLastRow ? 'Type to search...' : ''}
                                                autoComplete="off"
                                                spellCheck={false}
                                                className="
                                        w-full
                                        h-full
                                        px-5
                                        bg-transparent
                                        text-[14px]
                                        font-bold
                                        text-[#0F172A]
                                        placeholder:text-[[#CBD5E1]]
                                        focus:outline-none
                                    "
                                            />

                                            {showSuggAt(ri, COL_NAME) && (
                                                <SuggList ri={ri} />
                                            )}
                                        </div>
                                    </td>

                                    {/* QTY */}
                                    <td className={`
                            border-r
                            border-b
                            border-[#CBD5E1]
                            bg-white
                            relative
                            ${qtyActive
                                            ? 'ring-2 ring-inset ring-[#6366F1]'
                                            : ''
                                        }
                        `}>
                                        {row.isProduct ? (
                                            <div className="h-[45px] flex items-center justify-center gap-3">

                                                <button
                                                    tabIndex={-1}
                                                    onMouseDown={e => {
                                                        e.preventDefault();

                                                        const q = Math.max(
                                                            1,
                                                            (parseInt(row.qty) || 1) - 1
                                                        );

                                                        setRows(prev => {
                                                            const n = [...prev];
                                                            n[ri] = {
                                                                ...n[ri],
                                                                qty: String(q),
                                                            };
                                                            return n;
                                                        });
                                                    }}
                                                    className="
                                            w-8
                                            h-8
                                            rounded-xl
                                            border
                                            border-[#D6DEE8]
                                            bg-white
                                            text-[#475569]
                                            hover:border-red-300
                                            hover:text-red-500
                                            hover:bg-red-50
                                            flex
                                            items-center
                                            justify-center
                                            text-[20px]
                                            font-black
                                            shadow-[0_1px_2px_rgba(15,23,42,0.06)]
                                            transition-all
                                        "
                                                >
                                                    −
                                                </button>

                                                <input
                                                    ref={el => regRef(ri, COL_QTY, el)}
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={row.qty}
                                                    onChange={e => handleQtyChange(e, ri)}
                                                    onKeyDown={e => handleKeyDown(e, ri, COL_QTY)}
                                                    onFocus={() => {
                                                        setActiveCell({
                                                            row: ri,
                                                            col: COL_QTY,
                                                        });

                                                        setSuggestions([]);
                                                    }}
                                                    autoComplete="off"
                                                    className="
                                            w-10
                                            bg-transparent
                                            text-center
                                            text-[16px]
                                            font-black
                                            text-[#0F172A]
                                            tabular-nums
                                            focus:outline-none
                                        "
                                                />

                                                <button
                                                    tabIndex={-1}
                                                    onMouseDown={e => {
                                                        e.preventDefault();

                                                        const q =
                                                            (parseInt(row.qty) || 0) + 1;

                                                        setRows(prev => {
                                                            const n = [...prev];

                                                            n[ri] = {
                                                                ...n[ri],
                                                                qty: String(q),
                                                            };

                                                            return n;
                                                        });
                                                    }}
                                                    className="
                                            w-8
                                            h-8
                                            rounded-xl
                                            border
                                            border-[#D6DEE8]
                                            bg-white
                                            text-[#475569]
                                            hover:border-green-300
                                            hover:text-green-600
                                            hover:bg-green-50
                                            flex
                                            items-center
                                            justify-center
                                            text-[20px]
                                            font-black
                                            shadow-[0_1px_2px_rgba(15,23,42,0.06)]
                                            transition-all
                                        "
                                                >
                                                    +
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="h-[45px]" />
                                        )}
                                    </td>

                                    {/* PRICE */}
                                    <td className="px-5 text-right border-r border-b border-[#CBD5E1] bg-white">
                                        {row.isProduct && (
                                            <span className="text-[14px] font-bold text-[#64748B] tabular-nums">
                                                ₹{row.price.toFixed(2)}
                                            </span>
                                        )}
                                    </td>

                                    {/* TOTAL */}
                                    <td className="px-5 text-right border-r border-b border-[#CBD5E1] bg-white">
                                        {row.isProduct && (
                                            <span className={`
                                    text-[15px]
                                    font-black
                                    tabular-nums
                                    ${isActiveRow
                                                    ? 'text-[#4F46E5]'
                                                    : 'text-[#0F172A]'
                                                }
                                `}>
                                                ₹{total.toFixed(2)}
                                            </span>
                                        )}
                                    </td>

                                    {/* MENU */}
                                    <td className="text-center border-b border-[#CBD5E1] bg-white">
                                        {row.isProduct && (
                                            <button
                                                tabIndex={-1}
                                                onClick={() => removeRow(ri)}
                                                className="
                                        p-1.5
                                        rounded-lg
                                        text-[#94A3B8]
                                        hover:text-[#334155]
                                        hover:bg-[#F1F5F9]
                                        transition-all
                                        opacity-0
                                        group-hover:opacity-100
                                    "
                                            >
                                                <MoreVertical size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {/* ── Footer ── */}
            <div className="flex-shrink-0 border-t-2 border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex items-stretch">

                    {/* Totals — left panel */}
                    <div className="flex-1 px-6 py-4">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sub Total</span>
                            <span className="text-[14px] font-semibold text-slate-700 tabular-nums">₹{grandTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Discount</span>
                            <span className="text-[14px] font-semibold text-slate-700 tabular-nums">₹0.00</span>
                        </div>
                        <div className="flex items-end justify-between pt-3 border-t-2 border-slate-200">
                            <span className="text-[12px] font-black text-slate-700 uppercase tracking-widest">Net Amount</span>
                            <span className={`text-4xl font-black tracking-tight tabular-nums leading-none ${hasItems ? 'text-slate-900' : 'text-slate-300'}`}>
                                ₹{grandTotal.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Right panel — shortcuts + confirm */}
                    <div className="flex flex-col border-l-2 border-slate-200 min-w-[280px]">
                        {/* Keyboard shortcuts bar */}
                        <div className="flex-1 px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50/50">
                            {([['↑↓', 'Rows'], ['←→', 'Cols'], ['↵', 'Select'], ['+/−', 'Qty'], ['F9', 'Print']] as const).map(([k, l]) => (
                                <span key={k} className="flex items-center gap-1 text-[9px] text-slate-400 uppercase tracking-wide whitespace-nowrap">
                                    <kbd className="font-mono bg-white border border-slate-300 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm">{k}</kbd>
                                    {l}
                                </span>
                            ))}
                        </div>

                        {/* Confirm button — premium gradient */}
                        <button
                            onClick={triggerConfirmFlow}
                            disabled={!hasItems || isSubmitting}
                            className={`relative flex-1 flex flex-col items-center justify-center gap-1 font-black tracking-widest uppercase transition-all duration-200 overflow-hidden ${isSubmitting
                                ? 'bg-indigo-400 text-white cursor-wait'
                                : hasItems
                                    ? confirmPending
                                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white scale-[0.99]'
                                        : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white hover:scale-[1.01] shadow-lg shadow-indigo-500/20'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            {isSubmitting ? (
                                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 text-[14px]">
                                        <Printer size={16} strokeWidth={2.5} />
                                        <span>{confirmPending ? 'Press again…' : 'Confirm & Print'}</span>
                                    </div>

                                </>
                            )}
                            {/* Progress strip */}
                            {confirmPending && (
                                <div className="absolute bottom-0 left-0 h-0.5 bg-white/20 w-full">
                                    <div className="h-full bg-white/60 transition-all duration-75 ease-linear" style={{ width: `${confirmProgress}%` }} />
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
