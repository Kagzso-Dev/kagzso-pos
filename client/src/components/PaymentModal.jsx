import { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Banknote, QrCode,
    CheckCircle, AlertCircle, Loader2, ArrowRight, ArrowLeft,
    Upload, Camera, Save, UploadCloud, Tag, ToggleLeft, ToggleRight
} from 'lucide-react';

/* ── Payment method config ────────────────────────────────────────────── */
const METHODS = [
    { id: 'cash',  label: 'Cash',    icon: Banknote, color: 'from-emerald-500 to-green-600', accent: 'emerald' },
    { id: 'qr',   label: 'QR Code', icon: QrCode,   color: 'from-violet-500 to-purple-600', accent: 'violet'  },
];

const QR_TYPES = [
    { id: 'standard',  label: 'Standard QR' },
    { id: 'secondary', label: 'Secondary QR' },
];

/* ── Success sound (tiny inline base64 beep) ──────────────────────────── */
const playSuccessSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
        // Second tone
        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 1320;
            osc2.type = 'sine';
            gain2.gain.setValueAtTime(0.3, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.6);
        }, 150);
    } catch (_) { /* AudioContext not available */ }
};

/**
 * PaymentModal
 * Props:
 *   order        – the order object
 *   formatPrice  – price formatter fn
 *   onClose      – close modal callback
 *   onSuccess    – payment success callback (receives { order, payment })
 *   api          – axios instance
 */
const PaymentModal = ({ order, formatPrice, onClose, onSuccess, api, settings }) => {
    const baseTotal = order?.finalAmount || 0;

    const [method, setMethod] = useState(null);
    const [step, setStep] = useState('select'); // select | form | processing | success | error
    const [error, setError] = useState('');
    const [isOfflinePayment, setIsOfflinePayment] = useState(false);

    // Offer state
    const [offerApplied, setOfferApplied] = useState(false);
    const offerLabel = 'Cashier Offer';
    const discountAmt = offerApplied && settings?.cashierOfferDiscount
        ? Math.round((baseTotal * settings.cashierOfferDiscount) / 100 * 100) / 100
        : 0;

    const total = offerApplied ? Math.max(0, baseTotal - discountAmt) : baseTotal;

    // Cash state
    const [amountReceived, setAmountReceived] = useState('');
    const [change, setChange] = useState(0);

    // Digital payment state
    const [paidAmount, setPaidAmount] = useState('');

    // QR state — seeded from settings (kept in sync via socket through AuthContext)
    const [qrUrls, setQrUrls] = useState({
        standard:  settings?.standardQrUrl  || null,
        secondary: settings?.secondaryQrUrl || null,
    });
    const [selectedQrType, setSelectedQrType] = useState('standard');
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [localMsg, setLocalMsg] = useState(null);

    const modalRef = useRef(null);
    const inputRef = useRef(null);
    const isOrderReady = ['ready', 'readyToServe', 'payment'].includes(order?.orderStatus) && 
                         !order?.isPartiallyReady && 
                         (order?.items || []).every(i => ['READY', 'CANCELLED'].includes(i.status?.toUpperCase()));
    
    // Auto-close or show warning if order status changes to not ready while open
    useEffect(() => {
        if (!isOrderReady && step !== 'success' && step !== 'processing' && step !== 'select') {
            setError('Kitchen status updated. Please review order before payment.');
            setStep('error');
        }
    }, [isOrderReady, step]);

    /* ── Initiate payment on mount ────────────────────────────────── */
    useEffect(() => {
        if (!order?._id) return;
        let cancelled = false;

        const initiate = async () => {
            try {
                await api.post(`/api/payments/${order._id}/initiate`);
            } catch (err) {
                if (!cancelled) {
                    const msg = err.response?.data?.message || 'Failed to initiate payment';
                    // If already in payment flow or paid, don't block
                    if (!msg.includes('already')) {
                        setError(msg);
                        setStep('error');
                    }
                }
            }
        };

        initiate();

        return () => {
            cancelled = true;
        };
    }, [order?._id, api]);

    /* ── Auto-apply offer if enabled on mount ─────────────────────── */
    useEffect(() => {
        if (settings?.cashierOfferEnabled && settings?.cashierOfferDiscount > 0) {
            setOfferApplied(true);
        }
    }, [settings]);

    /* ── Cancel payment on close ──────────────────────────────────── */
    const handleClose = useCallback(async () => {
        if (step !== 'success') {
            try {
                await api.post(`/api/payments/${order._id}/cancel`);
            } catch (_) { /* ignore cancel errors */ }
        }
        onClose();
    }, [step, order?._id, api, onClose]);

    /* ── Close on Escape ──────────────────────────────────────────── */
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape' && step !== 'processing') handleClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [handleClose, step]);

    /* ── Close on backdrop click ──────────────────────────────────── */
    const handleBackdrop = (e) => {
        if (e.target === modalRef.current && step !== 'processing') handleClose();
    };

    /* ── Auto-focus input when method changes ─────────────────────── */
    useEffect(() => {
        if (step === 'form') {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [step]);

    /* ── Sync QR URLs from settings (socket-updated via AuthContext) ── */
    useEffect(() => {
        if (!selectedFile) {
            // Only sync when no local file preview is active
            setQrUrls({
                standard:  settings?.standardQrUrl  || null,
                secondary: settings?.secondaryQrUrl || null,
            });
        }
    }, [settings, selectedFile]);

    /* ── Handle QR File Upload ───────────────────────────────────── */
    const handleFile = (file) => {
        if (!file) return;
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setQrUrls(prev => ({ ...prev, [selectedQrType]: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setUploading(true);
        setLocalMsg(null);
        try {
            const formData = new FormData();
            formData.append('type', selectedQrType);
            formData.append('qr', selectedFile);

            await api.post('/api/settings/qr', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setLocalMsg({ ok: true, text: 'QR Updated — visible to all!' });
            setSelectedFile(null); // triggers sync from settings (socket will update settings)
            setTimeout(() => setLocalMsg(null), 3000);
        } catch (err) {
            setLocalMsg({ ok: false, text: 'Upload failed' });
        }
        setUploading(false);
    };

    /* ── Select method ────────────────────────────────────────────── */
    const selectMethod = (m) => {
        setMethod(m);
        setError('');
        setAmountReceived('');

        setPaidAmount(String(total));
        setChange(0);
        setSelectedQrType('standard');
        setStep('form');
    };





    /* ── Cash: calculate change ────────────────────────────────────── */
    useEffect(() => {
        if (method?.id === 'cash') {
            const recv = parseFloat(amountReceived) || 0;
            setChange(Math.max(0, Math.round((recv - total) * 100) / 100));
        }
    }, [amountReceived, total, method]);


    /* ── Validate form ────────────────────────────────────────────── */
    const isFormValid = () => {
        if (!method) return false;

        if (method.id === 'cash') {
            const recv = parseFloat(amountReceived) || 0;
            return recv >= total;
        }

        // Digital methods
        return true;
    };

    /* ── Submit payment ───────────────────────────────────────────── */
    const handleSubmit = async () => {
        if (!isFormValid()) return;

        setStep('processing');
        setError('');

        const payload = {
            paymentMethod: method.id,
            amountReceived: method.id === 'cash'
                ? parseFloat(amountReceived)
                : parseFloat(paidAmount),
            transactionId: null,
            ...(offerApplied && { discount: discountAmt, discountLabel: offerLabel }),
        };

        if (!navigator.onLine) {
            const pending = JSON.parse(localStorage.getItem('pendingPayments') || '[]');
            pending.push({
                orderId: order._id,
                payload,
                createdAt: Date.now(),
                status: 'pending'
            });
            localStorage.setItem('pendingPayments', JSON.stringify(pending));
            setChange(method.id === 'cash' ? parseFloat(amountReceived) - total : 0);
            setIsOfflinePayment(true);
            setStep('success');
            setTimeout(() => {
                onSuccess?.({ payment: { changeAmount: method.id === 'cash' ? parseFloat(amountReceived) - total : 0 }, offline: true });
            }, 2500);
            return;
        }

        try {
            const res = await api.post(`/api/payments/${order._id}/process`, payload);

            playSuccessSound();
            setChange(res.data.payment?.changeAmount || 0);
            setStep('success');

            setTimeout(() => {
                onSuccess?.(res.data);
            }, 2500);
        } catch (err) {
            setError(err.response?.data?.message || 'Payment failed. Please try again.');
            setStep('form');
        }
    };

    if (!order) return null;

    return (
        <div
            ref={modalRef}
            onClick={handleBackdrop}
            className="fixed inset-0 z-[10000] flex items-center sm:justify-center bg-black/60 backdrop-blur-[4px] animate-cross-fade p-2 sm:p-4"
        >
            <div className={`
                relative w-full sm:w-[380px] max-w-[95vw] sm:max-w-[380px] max-h-[85vh] sm:max-h-[80vh]
                bg-white dark:bg-[var(--theme-bg-card)] border border-[var(--theme-border)]
                shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)]
                flex flex-col
                ${step === 'success' ? 'animate-fade-in-scale' : 'animate-pop-in'}
                rounded-2xl sm:rounded-[2.5rem] overflow-hidden
            `}>


                {/* ── Header ──────────────────────────────────────── */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-[var(--theme-border)] flex-shrink-0 bg-white dark:bg-[var(--theme-bg-card)]">
                    <h2 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-[var(--theme-text-main)]">
                        {step === 'success' ? 'Payment Success' : 'Checkout & Pay'}
                    </h2>
                    <button 
                        onClick={handleClose} 
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95 shadow-sm"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                {/* ── Body (scrollable) ──────────────────────────── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    {/* ── Amount Banner ───────────────────────────────── */}
                    {step !== 'success' && step !== 'processing' && (
                        <div className="px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-br from-[var(--theme-bg-muted)]/10 to-transparent border-b border-[var(--theme-border)] flex-shrink-0 animate-fade-in relative overflow-hidden">
                            <div className="flex items-center justify-between gap-4 relative z-10">
                                {/* Order Context Badges */}
                                <div className="flex flex-col gap-1.5 shrink-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[8px] sm:text-[9px] font-black bg-white dark:bg-white/5 rounded-full px-2 sm:px-3 py-1.5 text-[var(--theme-text-main)] border border-[var(--theme-border)] shadow-sm uppercase tracking-wider">
                                            {order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}
                                        </span>
                                    </div>
                                    <span className="text-[8px] sm:text-[9px] w-fit font-black bg-orange-500/10 rounded-full px-2 sm:px-3 py-1.5 text-orange-500 border border-orange-500/20 uppercase tracking-wider leading-none">
                                        {order.orderType === 'dine-in' ? `Table ${order.tableId?.number || '?'}` : `Token ${order.tokenNumber}`}
                                    </span>
                                </div>

                                <div className="flex flex-col items-end gap-0.5 min-w-0">
                                    <p className="text-[8px] sm:text-[9px] text-[var(--theme-text-muted)] font-black uppercase tracking-[0.25em] mb-1 opacity-60">Grand Total</p>
                                    <div className="flex flex-col items-end leading-none">
                                        <p className="text-2xl sm:text-3xl xs:text-4xl font-black text-orange-500 tracking-tighter drop-shadow-xl animate-fade-in-up whitespace-nowrap">
                                            {formatPrice(total)}
                                        </p>
                                    </div>
                                    {offerApplied && (
                                        <div className="mt-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-1.5 animate-bounce-in">
                                            <Tag size={10} className="text-emerald-500" />
                                            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                                                Saved {formatPrice(discountAmt)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Error State ─────────────────────────────── */}
                    {step === 'error' && (
                        <div className="p-6 flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                                <AlertCircle size={24} className="text-red-400" />
                            </div>
                            <p className="text-[var(--theme-text-main)] font-bold mb-1 text-sm">Payment Error</p>
                            <p className="text-xs text-[var(--theme-text-muted)]">{error}</p>
                            <button
                                onClick={handleClose}
                                className="mt-4 px-5 py-2 bg-[var(--theme-bg-hover)] text-[var(--theme-text-main)] rounded-lg text-xs font-semibold hover:bg-[var(--theme-border)] transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    {/* ── Step 1: Method Selection ───────────────── */}
                    {step === 'select' && (
                        <div className="p-4 sm:p-5 space-y-3">
                            <div className="flex flex-col gap-2 relative z-10">
                                {METHODS.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => selectMethod(m)}
                                        className="
                                            group flex items-center gap-4 p-4 rounded-[1.5rem]
                                            bg-gray-50/50 dark:bg-white/5 border border-[var(--theme-border)]
                                            hover:border-orange-500/40 hover:bg-white dark:hover:bg-white/10
                                            transition-all duration-300 active:scale-[0.98] shadow-sm hover:shadow-xl
                                        "
                                    >
                                        <div className={`
                                            w-10 h-10 rounded-xl bg-gradient-to-br ${m.color}
                                            flex items-center justify-center shadow-lg
                                            group-hover:scale-110 transition-transform duration-500
                                        `}>
                                            <m.icon className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <span className="block text-lg font-black text-[var(--theme-text-main)] tracking-tight">{m.label}</span>
                                        </div>
                                        <ArrowRight size={18} className="text-[var(--theme-text-muted)] group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>

                            {/* Secure Settlement section removed per request */}
                        </div>
                    )}

                    {/* ── Step 2: Payment Form ───────────────────── */}
                    {step === 'form' && method && (
                        <div className="p-4 sm:p-5 space-y-4">
                            {/* Method indicator */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setStep('select')}
                                    className="flex items-center gap-1 text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] transition-colors group"
                                >
                                    <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                                    <span>Back</span>
                                </button>
                                <div className={`
                                    ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg
                                    bg-gradient-to-r ${method.color} text-white text-xs font-bold
                                `}>
                                    <method.icon size={14} />
                                    {method.label}
                                </div>
                            </div>

                            {/* ── Cash Form ──────────────────────── */}
                            {method.id === 'cash' && (
                                <div className="space-y-4">


                                    {/* Amount input */}
                                    <div>
                                        <label className="text-xs text-[var(--theme-text-muted)] font-bold uppercase tracking-wider mb-2 block">
                                            Amount Received
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[var(--theme-text-muted)]">₹</span>
                                            <input
                                                ref={inputRef}
                                                type="number"
                                                value={amountReceived}
                                                onChange={e => setAmountReceived(e.target.value)}
                                                placeholder="0.00"
                                                className="
                                                    w-full pl-10 pr-4 py-3.5 text-xl font-bold rounded-xl
                                                    bg-[var(--theme-input-bg)] border border-[var(--theme-border-solid)]
                                                    text-[var(--theme-text-main)] placeholder-[var(--theme-text-subtle)]
                                                    focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                                                    transition-all
                                                "
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>

                                    {/* Change display */}
                                    {parseFloat(amountReceived) >= total && (
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between animate-fade-in">
                                            <span className="text-sm font-bold text-emerald-400">Change to Return</span>
                                            <span className="text-2xl font-black text-emerald-400">{formatPrice(change)}</span>
                                        </div>
                                    )}

                                    {/* Insufficient warning */}
                                    {amountReceived && parseFloat(amountReceived) < total && (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 animate-fade-in">
                                            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                                            <span className="text-xs text-red-400 font-medium">
                                                Insufficient amount. Need {formatPrice(total - (parseFloat(amountReceived) || 0))} more.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── QR Form ─────────────────────────── */}
                            {method.id === 'qr' && (
                                <div className="space-y-4">
                                    {/* Standard / Secondary toggle + Upload tools */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            {QR_TYPES.map(qt => (
                                                <button
                                                    key={qt.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedQrType(qt.id);
                                                        setSelectedFile(null);
                                                        setLocalMsg(null);
                                                    }}
                                                    className={`
                                                        py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all
                                                        ${selectedQrType === qt.id
                                                            ? 'bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-500/20'
                                                            : 'bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:border-violet-500/40'
                                                        }
                                                    `}
                                                >
                                                    {qt.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Action Icons (Visible ONLY for Secondary QR, if admin allows upload) */}
                                        {selectedQrType === 'secondary' && settings?.cashierQrUploadEnabled !== false && (
                                            <div className="flex items-center gap-1.5 px-1.5 py-1.5 bg-[var(--theme-bg-hover)] border border-[var(--theme-border)] rounded-xl animate-fade-in">
                                                <label htmlFor="modal-qr-upload" title="Upload QR" className="p-2 bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 rounded-lg cursor-pointer transition-colors active:scale-95">
                                                    <Upload size={16} />
                                                </label>
                                                <input id="modal-qr-upload" type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                                                
                                                <label htmlFor="modal-qr-snap" title="Take Snap" className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg cursor-pointer transition-colors active:scale-95 border border-amber-500/20">
                                                    <Camera size={16} />
                                                </label>
                                                <input id="modal-qr-snap" type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                                            </div>
                                        )}
                                    </div>

                                    {/* QR image area with floating save */}
                                    <div className="relative group">
                                        <div className="bg-white rounded-2xl p-5 flex flex-col items-center border border-gray-200 shadow-inner overflow-hidden">
                                            {qrUrls[selectedQrType] ? (
                                                <div className="animate-fade-in flex flex-col items-center">
                                                    <img
                                                        src={qrUrls[selectedQrType]}
                                                        alt="Payment QR"
                                                        className="w-52 h-52 object-contain"
                                                    />
                                                    <p className="mt-2 text-lg font-black text-gray-900 leading-none">
                                                        Total: {formatPrice(total)}
                                                    </p>
                                                    <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-widest font-bold">
                                                        {selectedQrType === 'standard' ? 'Standard Account' : 'Temporary / Secondary Account'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="w-52 h-52 flex flex-col items-center justify-center text-center gap-3">
                                                    <UploadCloud size={44} className="text-gray-200 animate-pulse" />
                                                    <div>
                                                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-tight">No QR Available</p>
                                                        <p className="text-[9px] text-gray-400/60 mt-0.5">Click camera icon to upload</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Floating Save Button */}
                                        {selectedFile && (
                                            <button
                                                onClick={handleUpload}
                                                disabled={uploading}
                                                className="absolute bottom-4 inset-x-4 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl animate-bounce-in flex items-center justify-center gap-2"
                                            >
                                                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                {uploading ? 'Updating Server...' : 'Save QR to System'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Feedback Message */}
                                    {localMsg && (
                                        <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide animate-fade-in ${
                                            localMsg.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                                        }`}>
                                            {localMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                            {localMsg.text}
                                        </div>
                                    )}

                                    {/* Confirmation Message */}
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
                                        <p className="text-xs text-blue-400 font-medium">
                                            Confirm this payment after verifying the transaction on your device.
                                        </p>
                                    </div>

                                </div>
                            )}

                            {/* ── Error message ──────────────────── */}
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 animate-fade-in">
                                    <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                                    <span className="text-xs text-red-400 font-medium">{error}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Processing State ────────────────────────── */}
                    {step === 'processing' && (
                        <div className="p-8 sm:p-12 flex flex-col items-center text-center">
                            <div className="relative w-16 sm:w-20 h-16 sm:h-20 mb-4 sm:mb-6">
                                <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full" />
                                <div className="absolute inset-0 border-4 border-t-orange-500 rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 size={20} sm:size={24} className="text-orange-400 animate-spin" />
                                </div>
                            </div>
                            <p className="text-base sm:text-lg font-bold text-[var(--theme-text-main)]">Processing Payment...</p>
                            <p className="text-xs sm:text-sm text-[var(--theme-text-muted)] mt-1">Please wait, do not close this window</p>
                        </div>
                    )}

                    {/* ── Success State ───────────────────────────── */}
                    {step === 'success' && (
                        <div className="p-6 sm:p-8 flex flex-col items-center text-center animate-scale-in">
                            <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-full bg-emerald-500 flex items-center justify-center mb-4 sm:mb-5 shadow-lg shadow-emerald-500/30 animate-bounce">
                                <CheckCircle size={32} sm:size={40} className="text-white" />
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-[var(--theme-text-main)] mb-1">Payment Successful!</h3>
                            <p className="text-emerald-400 text-xs sm:text-sm font-medium mb-3 sm:mb-4">
                                {method?.label} • {formatPrice(total)}
                                {offerApplied && <span className="ml-2 text-amber-400 text-xs">({offerLabel} applied)</span>}
                            </p>

                            {method?.id === 'cash' && change > 0 && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 sm:p-4 w-full max-w-[250px] mb-3 sm:mb-4">
                                    <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1">Change to Return</p>
                                    <p className="text-2xl sm:text-3xl font-black text-emerald-400">{formatPrice(change)}</p>
                                </div>
                            )}

                            {isOfflinePayment ? (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 mt-3 animate-fade-in">
                                    <p className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                                        Offline Payment • Will sync when online
                                    </p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    <p className="text-xs text-[var(--theme-text-muted)]">
                                        KOT closed • Order completed • Closing...
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                    {/* ── Footer / Submit Button ── */}
                    {step === 'form' && (
                        <div className="flex-shrink-0 flex flex-col gap-2 xs:gap-3 p-4 sm:p-5 xs:p-8 border-t border-[var(--theme-border)] bg-gray-50/50 dark:bg-black/20 pb-4 sm:pb-6 safe-bottom">
                            <button
                                onClick={handleSubmit}
                                disabled={!isFormValid()}
                                className={`w-full h-14 xs:h-16 flex items-center justify-center text-[11px] xs:text-sm font-black uppercase tracking-[0.2em] rounded-[1.2rem] xs:rounded-[1.5rem] transition-all ${
                                    isFormValid()
                                        ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-[0_15px_40px_rgba(249,115,22,0.3)] active:scale-[0.98]'
                                        : 'bg-gray-200 dark:bg-white/5 text-gray-400 cursor-not-allowed border border-[var(--theme-border)]'
                                }`}
                            >
                                {isFormValid() ? 'Complete Transaction' : 'Enter Valid Amount'}
                            </button>

                        </div>
                    )}

                    {/* Success/Error Close Button */}
                    {(step === 'success' || step === 'error') && (
                        <div className="flex-shrink-0 p-4 sm:p-5 xs:p-8 border-t border-[var(--theme-border)] bg-gray-50/50 dark:bg-black/10 pb-4 sm:pb-6 safe-bottom">
                             <button
                                onClick={handleClose}
                                className="w-full h-12 sm:h-14 xs:h-16 flex items-center justify-center text-[11px] sm:text-[12px] xs:text-[13px] text-[var(--theme-text-muted)] font-black uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-white/5 rounded-[1.2rem] xs:rounded-[1.5rem] transition-all active:scale-95 border border-[var(--theme-border)] group"
                            >
                                {step === 'success' ? 'Good to Completed ✓' : 'Back to Orders'}
                                <ArrowRight size={14} className="ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            </button>
                        </div>
                    )}
            </div>
        </div>
    );
};

export default PaymentModal;
