import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';

const CancelOrderModal = ({ order, item, isOpen, onClose, onConfirm, title = "Cancel Order" }) => {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    // Reset reason when modal opens/closes
    useEffect(() => {
        if (!isOpen) setReason('');
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!reason.trim()) return;
        setLoading(true);
        try {
            if (item) {
                await onConfirm(order._id, item._id, reason);
            } else {
                await onConfirm(order._id, reason);
            }
            onClose();
        } catch (err) {
            alert(err?.response?.data?.message || err?.message || 'Cancellation failed');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 text-left">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

            {/* Modal Content */}
            <div className="relative bg-[var(--theme-bg-card)] w-full sm:w-[400px] rounded-t-[2.5rem] sm:rounded-3xl shadow-[0_-10px_50px_rgba(0,0,0,0.5)] sm:shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-400 border-t sm:border border-[var(--theme-border)] max-h-[85vh] sm:max-h-[90vh]">
                
                {/* Drag Handle (Mobile) */}
                <div className="sm:hidden flex justify-center pt-3 pb-1">
                    <div className="w-12 h-1.5 rounded-full bg-[var(--theme-border)] opacity-50" />
                </div>

                {/* Status Bar */}
                <div className="h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 w-full shrink-0" />

                <div className="hidden sm:block absolute top-4 right-4 z-10">
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--theme-bg-dark)]/50 text-[var(--theme-text-muted)] hover:text-red-500 transition-all active:scale-95">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-4 sm:pt-8">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center gap-3 mb-6">
                        <div className="w-16 h-16 bg-red-500/15 rounded-[2rem] flex items-center justify-center text-red-500 mb-1 border border-red-500/20 shadow-lg shadow-red-500/10">
                            <AlertTriangle size={32} strokeWidth={2.5} className="animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight leading-none uppercase text-[var(--theme-text-main)] mb-2">
                                {title}
                            </h3>
                            {item || order ? (
                                <p className="inline-flex items-center text-[10px] font-black bg-red-500/10 px-3 py-1.5 rounded-full text-red-600 border border-red-500/20 uppercase tracking-widest">
                                    Target: {item ? item.name : (order?.orderType === 'dine-in' ? 'DI' : 'TK') + '-' + (String(order?.orderNumber).startsWith('ORD-') ? String(order?.orderNumber).replace('ORD-', '') : order?.orderNumber)}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    {/* Form Container */}
                    <div className="space-y-6">
                        <div className="p-5 bg-[var(--theme-bg-dark)]/50 rounded-2xl border border-[var(--theme-border)]/50">
                            <p className="text-[13px] text-center text-[var(--theme-text-muted)] font-black uppercase tracking-wider leading-relaxed opacity-60">
                                This action is permanent and will notify all relevant staff.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-[var(--theme-text-muted)] px-1">
                                Cancellation Reason
                            </label>

                            {/* Quick Select Buttons */}
                            <div className="flex flex-wrap gap-2 justify-center pb-2">
                                {['Out of Stock', 'Guest Changed', 'Mistake'].map(r => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setReason(r)}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${reason === r ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20 scale-95' : 'bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:border-red-500/40'}`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>

                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Provide specific details..."
                                className="w-full bg-[var(--theme-bg-dark)] border-2 border-[var(--theme-border)] rounded-2xl p-4 text-[var(--theme-text-main)] text-sm placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-red-500/50 min-h-[100px] resize-none transition-all font-bold shadow-inner"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Footer - iOS Style */}
                <div className="flex-shrink-0 grid grid-cols-2 bg-[var(--theme-bg-dark)]/80 border-t border-[var(--theme-border)] safe-area-bottom">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-16 flex items-center justify-center text-[12px] text-[var(--theme-text-muted)] font-black uppercase tracking-[0.3em] hover:bg-slate-500/10 active:bg-slate-500/20 transition-all border-r border-[var(--theme-border)]"
                    >
                        Nevermind
                    </button>
                    <button
                        type="button"
                        disabled={loading || !reason.trim()}
                        onClick={handleSubmit}
                        className="h-16 flex items-center justify-center text-[12px] text-red-500 font-black uppercase tracking-[0.3em] hover:bg-red-500/10 disabled:opacity-30 disabled:grayscale transition-all active:scale-95"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                Processing
                            </span>
                        ) : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CancelOrderModal;

