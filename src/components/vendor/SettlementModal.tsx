'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVendor } from '@/contexts/VendorContext';
import { useAuth } from '@/contexts/AuthContext';
import {
    X, Copy, CheckCircle2, AlertCircle, ExternalLink,
    ShoppingBag, IndianRupee, Calendar, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SettlementData {
    settlement: {
        status: string;
        total_online_orders: number;
        rate_per_order: number;
        payable_amount: number;
        period_start: string;
        period_end: string;
        transaction_id?: string;
    } | null;
    upiLink: string;
    qrDataUrl: string;
    upiId: string;
    periodLabel: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function SettlementModal({ isOpen, onClose }: Props) {
    const { user, phoneNumber } = useAuth();
    const { currentSettlement, refreshSettlement } = useVendor();

    const [data, setData] = useState<SettlementData | null>(null);
    const [loading, setLoading] = useState(false);
    const [showProof, setShowProof] = useState(false);
    const [utr, setUtr] = useState('');
    const [screenshotUrl, setScreenshotUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/settlements', {
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    'x-vendor-phone': phoneNumber ?? '',
                },
            });
            if (res.ok) setData(await res.json());
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, [user, phoneNumber]);

    useEffect(() => {
        if (isOpen) {
            fetchData();
            setShowProof(false);
            setUtr('');
            setScreenshotUrl('');
        }
    }, [isOpen, fetchData]);

    const copyUpiId = () => {
        if (!data?.upiId) return;
        navigator.clipboard.writeText(data.upiId).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleSubmit = async () => {
        if (!user || utr.trim().length < 4) {
            toast.error('Enter a valid Transaction ID / UTR (min 4 characters).');
            return;
        }
        setSubmitting(true);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/settlements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                    'x-vendor-phone': phoneNumber ?? '',
                },
                body: JSON.stringify({
                    transaction_id: utr.trim(),
                    screenshot_url: screenshotUrl.trim() || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.error ?? 'Submission failed.');
                return;
            }
            toast.success('✅ Payment recorded. Online orders unlocked!', {
                style: { borderRadius: '14px', fontWeight: 600 },
                duration: 4000,
            });
            await refreshSettlement();
            onClose();
        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const settlement = data?.settlement ?? (currentSettlement as SettlementData['settlement'] | null);
    const isPaid = settlement?.status === 'paid';
    const canPay = settlement && !isPaid && (settlement.payable_amount ?? 0) > 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[201] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <div>
                                <h2 className="text-base font-bold text-gray-900">Daily Settlement</h2>
                                <p className="text-[11px] text-gray-400 mt-0.5">Platform fee · ₹2 per online order</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {loading ? (
                                <div className="flex items-center justify-center h-40">
                                    <Loader2 size={24} className="animate-spin text-gray-300" />
                                </div>
                            ) : !settlement ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
                                    <CheckCircle2 size={32} className="text-emerald-400" />
                                    <p className="text-sm font-medium">No pending settlement</p>
                                </div>
                            ) : (
                                <>
                                    {/* Summary card */}
                                    <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 space-y-4">
                                        {data?.periodLabel && (
                                            <div className="flex items-center gap-2">
                                                <Calendar size={12} className="text-gray-400 shrink-0" />
                                                <p className="text-[12px] font-semibold text-gray-600">{data.periodLabel}</p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-3 gap-3">
                                            <StatBox icon={<ShoppingBag size={12} />} label="Orders" value={String(settlement.total_online_orders)} />
                                            <StatBox icon={<IndianRupee size={12} />} label="Rate" value={`₹${settlement.rate_per_order}`} />
                                            <StatBox icon={<IndianRupee size={12} />} label="Payable" value={`₹${settlement.payable_amount}`} accent />
                                        </div>

                                        <div className="text-center border-t border-gray-200 pt-3">
                                            <p className="text-[11px] text-gray-400">
                                                {settlement.total_online_orders} orders × ₹{settlement.rate_per_order}
                                            </p>
                                            <p className="text-3xl font-black text-gray-900 mt-0.5">₹{settlement.payable_amount}</p>
                                        </div>
                                    </div>

                                    {/* Paid state */}
                                    {isPaid && (
                                        <div className="flex gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                                            <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-[13px] font-bold text-emerald-700">Settlement Complete</p>
                                                {settlement.transaction_id && (
                                                    <p className="text-[11px] text-emerald-600 mt-0.5 font-mono">UTR: {settlement.transaction_id}</p>
                                                )}
                                                <p className="text-[11px] text-emerald-500 mt-1">Online orders are active.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Payment section */}
                                    {canPay && !showProof && (
                                        <div className="space-y-3">
                                            {/* UPI deep link button */}
                                            {data?.upiLink && (
                                                <a
                                                    href={data.upiLink}
                                                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[14px] transition-colors"
                                                >
                                                    <ExternalLink size={15} />
                                                    Pay ₹{settlement.payable_amount} via UPI App
                                                </a>
                                            )}

                                            {/* QR code */}
                                            {data?.qrDataUrl && (
                                                <div className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-100 rounded-2xl">
                                                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Scan & Pay</p>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={data.qrDataUrl} alt="UPI QR" width={180} height={180} className="rounded-lg" />
                                                    <p className="text-[13px] font-bold text-gray-900">₹{settlement.payable_amount}</p>
                                                </div>
                                            )}

                                            {/* UPI ID copy */}
                                            {data?.upiId && (
                                                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                                                    <span className="text-[11px] text-gray-400 font-medium shrink-0">UPI ID</span>
                                                    <span className="flex-1 text-[12px] font-mono font-bold text-gray-800 truncate">{data.upiId}</span>
                                                    <button onClick={copyUpiId} className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors">
                                                        {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => setShowProof(true)}
                                                className="w-full py-3 rounded-xl border-2 border-indigo-200 text-indigo-700 font-bold text-[13px] hover:bg-indigo-50 transition-colors"
                                            >
                                                I've paid — Enter UTR
                                            </button>
                                        </div>
                                    )}

                                    {/* UTR entry */}
                                    {canPay && showProof && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                                                <AlertCircle size={13} className="text-amber-500 shrink-0" />
                                                <p className="text-[11px] text-amber-700 font-medium">Enter the UTR from your UPI app to unlock online orders.</p>
                                            </div>

                                            <div>
                                                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                                                    Transaction ID / UTR <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={utr}
                                                    onChange={e => setUtr(e.target.value.toUpperCase())}
                                                    placeholder="e.g. 421234567890"
                                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                                    autoFocus
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                                                    Screenshot URL <span className="text-gray-400 font-normal">(optional)</span>
                                                </label>
                                                <input
                                                    type="url"
                                                    value={screenshotUrl}
                                                    onChange={e => setScreenshotUrl(e.target.value)}
                                                    placeholder="https://drive.google.com/..."
                                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                                />
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowProof(false)}
                                                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-[13px] hover:bg-gray-50 transition-colors"
                                                >
                                                    Back
                                                </button>
                                                <button
                                                    onClick={handleSubmit}
                                                    disabled={submitting || utr.trim().length < 4}
                                                    className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-[13px] transition-colors"
                                                >
                                                    {submitting ? (
                                                        <><Loader2 size={14} className="animate-spin" /> Unlocking...</>
                                                    ) : (
                                                        <><CheckCircle2 size={14} /> Confirm & Unlock</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function StatBox({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
    return (
        <div className="flex flex-col gap-0.5">
            <div className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${accent ? 'text-indigo-400' : 'text-gray-400'}`}>
                {icon} {label}
            </div>
            <p className={`text-[14px] font-bold ${accent ? 'text-indigo-700' : 'text-gray-800'}`}>{value}</p>
        </div>
    );
}
