'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    CheckCircle2, AlertCircle, Clock, X, ExternalLink,
    IndianRupee, ShoppingBag, Calendar, Loader2, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SettlementRow {
    id: string;
    settlement_date: string;
    period_start: string;
    period_end: string;
    total_online_orders: number;
    rate_per_order: number;
    payable_amount: number;
    status: string;
    transaction_id?: string;
    screenshot_url?: string;
    rejection_reason?: string;
    paid_at?: string;
    verified_at?: string;
    verified_by?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    pending: { label: 'Pending', className: 'bg-orange-50 text-orange-700 border-orange-100', icon: <Clock size={11} /> },
    overdue: { label: 'Overdue', className: 'bg-red-100 text-red-800 border-red-200', icon: <AlertCircle size={11} /> },
    verification_pending: { label: 'Verify Required', className: 'bg-amber-50 text-amber-700 border-amber-100', icon: <Clock size={11} /> },
    paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 size={11} /> },
    rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-100', icon: <X size={11} /> },
};

function fmtDate(iso: string | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });
}

export default function AdminSettlementsPage() {
    const { user, phoneNumber } = useAuth();
    const [settlements, setSettlements] = useState<SettlementRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState<string | null>(null);
    const [rejectOpen, setRejectOpen] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const fetchSettlements = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/admin/settlements', {
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    'x-vendor-phone': phoneNumber ?? '',
                },
            });
            if (res.ok) {
                const json = await res.json();
                setSettlements(json.settlements ?? []);
            } else {
                toast.error('Failed to load settlements.');
            }
        } catch {
            toast.error('Network error.');
        } finally {
            setLoading(false);
        }
    }, [user, phoneNumber]);

    useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

    const handleVerify = async (settlementDate: string, action: 'approve' | 'reject', reason?: string) => {
        if (!user) return;
        setVerifying(settlementDate);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/settlements/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                    'x-vendor-phone': phoneNumber ?? '',
                },
                body: JSON.stringify({ settlementDate, action, reason }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.error ?? 'Action failed.'); return; }
            toast.success(json.message ?? 'Done.');
            setRejectOpen(null);
            setRejectReason('');
            await fetchSettlements();
        } catch {
            toast.error('Network error.');
        } finally {
            setVerifying(null);
        }
    };

    const needsAction = settlements.filter(s => s.status === 'verification_pending');
    const others = settlements.filter(s => s.status !== 'verification_pending');

    return (
        <div className="min-h-screen bg-[#F7F7F8] p-6">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-gray-900">Settlement Dashboard</h1>
                        <p className="text-[13px] text-gray-500 mt-0.5">Daily platform fee settlements</p>
                    </div>
                    <button
                        onClick={fetchSettlements}
                        disabled={loading}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] text-gray-500 hover:text-gray-900 hover:bg-white border border-gray-200 transition-colors"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Action required */}
                {needsAction.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-[11px] font-bold text-amber-600 uppercase tracking-widest">
                            Needs Action ({needsAction.length})
                        </h2>
                        {needsAction.map(s => (
                            <SettlementCard
                                key={s.id}
                                s={s}
                                verifying={verifying}
                                rejectOpen={rejectOpen}
                                rejectReason={rejectReason}
                                onApprove={() => handleVerify(s.id, 'approve')}
                                onRejectOpen={() => { setRejectOpen(s.id); setRejectReason(''); }}
                                onRejectClose={() => setRejectOpen(null)}
                                onRejectReasonChange={setRejectReason}
                                onRejectSubmit={() => handleVerify(s.id, 'reject', rejectReason)}
                            />
                        ))}
                    </div>
                )}

                {/* History */}
                {others.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">History</h2>
                        {others.map(s => (
                            <SettlementCard
                                key={s.id}
                                s={s}
                                verifying={verifying}
                                rejectOpen={rejectOpen}
                                rejectReason={rejectReason}
                                onApprove={() => handleVerify(s.id, 'approve')}
                                onRejectOpen={() => { setRejectOpen(s.id); setRejectReason(''); }}
                                onRejectClose={() => setRejectOpen(null)}
                                onRejectReasonChange={setRejectReason}
                                onRejectSubmit={() => handleVerify(s.id, 'reject', rejectReason)}
                            />
                        ))}
                    </div>
                )}

                {loading && (
                    <div className="flex justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-gray-400" />
                    </div>
                )}

                {!loading && settlements.length === 0 && (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-sm font-medium">No settlements found</p>
                        <p className="text-xs mt-1">Settlements are generated daily at 9:00 AM IST.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function SettlementCard({
    s, verifying, rejectOpen, rejectReason,
    onApprove, onRejectOpen, onRejectClose, onRejectReasonChange, onRejectSubmit,
}: {
    s: SettlementRow;
    verifying: string | null;
    rejectOpen: string | null;
    rejectReason: string;
    onApprove: () => void;
    onRejectOpen: () => void;
    onRejectClose: () => void;
    onRejectReasonChange: (r: string) => void;
    onRejectSubmit: () => void;
}) {
    const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending;
    const isVerifying = verifying === s.id;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 space-y-3">
                {/* Top row */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[14px] font-bold text-gray-900">{s.settlement_date}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400">
                            <Calendar size={10} />
                            <span>
                                {fmtDate(s.period_start)} → {fmtDate(s.period_end)}
                            </span>
                        </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${cfg.className}`}>
                        {cfg.icon}
                        {cfg.label}
                    </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                            <ShoppingBag size={10} /> Orders
                        </div>
                        <p className="text-[14px] font-bold text-gray-900">{s.total_online_orders}</p>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                            <IndianRupee size={10} /> Rate
                        </div>
                        <p className="text-[14px] font-bold text-gray-900">₹{s.rate_per_order}</p>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-medium uppercase tracking-wide">
                            <IndianRupee size={10} /> Amount
                        </div>
                        <p className="text-[14px] font-bold text-indigo-700">₹{s.payable_amount}</p>
                    </div>
                </div>

                {/* Payment proof */}
                {s.transaction_id && (
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className="flex-1">
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">UTR / Transaction ID</p>
                            <p className="text-[13px] font-mono font-bold text-gray-800 mt-0.5">{s.transaction_id}</p>
                        </div>
                        {s.screenshot_url && (
                            <a
                                href={s.screenshot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium shrink-0"
                            >
                                <ExternalLink size={12} />
                                Screenshot
                            </a>
                        )}
                    </div>
                )}

                {/* Rejection reason */}
                {s.rejection_reason && (
                    <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                        Rejected: {s.rejection_reason}
                    </p>
                )}

                {/* Verified at */}
                {s.verified_at && (
                    <p className="text-[11px] text-gray-400">
                        {s.status === 'paid' ? 'Verified' : 'Reviewed'} on {fmtDate(s.verified_at)}
                    </p>
                )}

                {/* Action buttons */}
                {s.status === 'verification_pending' && (
                    <>
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={onRejectOpen}
                                disabled={isVerifying}
                                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold text-[12px] hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Reject
                            </button>
                            <button
                                onClick={onApprove}
                                disabled={isVerifying}
                                className="flex-[2] flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[12px] transition-colors disabled:opacity-50"
                            >
                                {isVerifying ? (
                                    <><Loader2 size={13} className="animate-spin" /> Approving...</>
                                ) : (
                                    <><CheckCircle2 size={13} /> Approve & Unlock</>
                                )}
                            </button>
                        </div>

                        {/* Reject reason input */}
                        {rejectOpen === s.id && (
                            <div className="pt-1 space-y-2">
                                <input
                                    type="text"
                                    value={rejectReason}
                                    onChange={e => onRejectReasonChange(e.target.value)}
                                    placeholder="Reason for rejection (optional)"
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[12px] focus:outline-none focus:ring-2 focus:ring-red-200"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={onRejectClose}
                                        className="flex-1 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-500 font-semibold hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={onRejectSubmit}
                                        disabled={isVerifying}
                                        className="flex-[2] flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-[12px] transition-colors disabled:opacity-50"
                                    >
                                        {isVerifying ? (
                                            <><Loader2 size={13} className="animate-spin" /> Rejecting...</>
                                        ) : (
                                            'Confirm Reject'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
