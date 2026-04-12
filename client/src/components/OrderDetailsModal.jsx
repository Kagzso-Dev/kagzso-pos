import { useEffect, useState } from 'react';
import {
    X, Clock, Utensils, Package,
    Printer, Plus, Check, CheckCircle, Loader2, Banknote
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { printBill } from './BillPrint';
import StatusBadge from './StatusBadge';

const formatTimeAgo = (minutes) => {
    if (minutes === null || minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        const remainingMins = minutes % 60;
        return `${hours}h${remainingMins > 0 ? ` ${remainingMins}m` : ''} ago`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (days < 30) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
};

const OrderDetailsModal = ({
    order,
    isOpen,
    onClose,
    formatPrice,
    onProcessPayment,
    onCancelItem,
    onCancelOrder,
    onUpdateStatus,
    onAddItem,
    userRole,
    settings = {},
    variant = 'overlay', // 'overlay' | 'panel'
}) => {
    const navigate = useNavigate();
    const [isRendered, setIsRendered] = useState(false);
    const [showPrintConfirm, setShowPrintConfirm] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    useEffect(() => {
        if (variant === 'panel') {
            setIsRendered(!!isOpen);
            return;
        }
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setIsRendered(true);
        } else {
            document.body.style.overflow = '';
            const timer = setTimeout(() => setIsRendered(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen, variant]);

    if (!isRendered) return null;

    const isPaid = order?.paymentStatus === 'paid';
    const isCompleted = order?.orderStatus === 'completed';
    const isCancelled = order?.orderStatus === 'cancelled';
    const isPaymentOngoing = order?.orderStatus === 'payment';
    const isReady = order?.orderStatus === 'ready' && 
                    !order?.isPartiallyReady && 
                    (order?.items || []).every(i => ['READY', 'CANCELLED'].includes(i.status?.toUpperCase()));

    if (!order) return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 modal-overlay-p bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div 
                className="bg-[var(--theme-bg-card)] w-full max-w-[420px] rounded-[2rem] modal-rounded-mobile shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-[var(--theme-border)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-8 space-y-4">
                    <div className="skeleton h-8 w-1/2 rounded-xl" />
                    <div className="grid grid-cols-2 gap-3">
                        <div className="skeleton h-20 rounded-xl" />
                        <div className="skeleton h-20 rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    );

    const innerCard = (
        <div className="flex flex-col h-full overflow-hidden font-inter">
            {/* ── Premium Header ──────────────────────────────────────── */}
            <div className={`relative flex flex-col px-5 xs:px-7 py-5 xs:py-6 border-b border-[var(--theme-border)] flex-shrink-0 gap-5 ${variant === 'panel' ? 'bg-[var(--theme-bg-dark)]/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]' : ''}`}>
                
                {/* Top Row: Navigation & Meta Actions */}
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <div className="shrink-0 scale-110">
                             <StatusBadge status={order.orderStatus} items={order.items || []} size="xs" />
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--theme-text-muted)] opacity-60 hidden xs:block">
                            {order.orderType === 'dine-in' ? 'In-House Dining' : 'Takeaway Order'}
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {(order?.items || []).some(item => item.isNewlyAdded) && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); printBill(order, formatPrice, settings, true, true); }}
                                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white transition-all duration-300 active:scale-95 border border-blue-500/20 group relative shadow-sm"
                                title="Print New Items KOT"
                            >
                                <Printer size={16} strokeWidth={3} />
                                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[7px] font-black px-2 py-0.5 rounded-full border-2 border-[var(--theme-bg-card)] shadow-[0_2px_10px_rgba(37,99,235,0.3)]">NEW</span>
                            </button>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); printBill(order, formatPrice, settings); }}
                            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-[var(--theme-bg-dark)]/50 text-[var(--theme-text-muted)] hover:text-orange-500 hover:bg-orange-500/10 transition-all duration-300 active:scale-95 border border-[var(--theme-border)] group shadow-sm"
                            title="Print Full Bill"
                        >
                            <Printer size={18} strokeWidth={3} />
                        </button>
                        {variant === 'panel' && (
                            <button 
                                onClick={onClose} 
                                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/50 dark:bg-white/5 hover:bg-red-500/10 hover:text-red-500 transition-all duration-300 text-[var(--theme-text-muted)] active:scale-95 border border-[var(--theme-border)] shadow-sm group"
                            >
                                <X size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Identity Row: Table/Token Badge and ID */}
                <div className="flex items-center gap-4 w-full">
                    <div className={`
                        flex flex-col items-center justify-center 
                        min-w-[50px] xs:min-w-[65px] h-[50px] xs:h-[65px] 
                        rounded-2xl border-2 shadow-2xl transition-all duration-500 group relative overflow-hidden shrink-0
                        ${isPaid 
                            ? 'bg-gradient-to-br from-red-500/20 to-red-700/10 border-red-500/30 text-red-600 shadow-red-500/10'
                            : order.orderType === 'dine-in' 
                                ? 'bg-gradient-to-br from-orange-400/20 to-orange-600/10 border-orange-500/30 text-orange-600 shadow-orange-500/10' 
                                : 'bg-gradient-to-br from-blue-400/20 to-blue-600/10 border-blue-500/30 text-blue-600 shadow-blue-500/10'}
                    `}>
                        <div className="absolute inset-0 bg-white/5 group-hover:bg-transparent transition-colors duration-500" />
                        <span className="text-[22px] xs:text-[34px] font-black leading-none tracking-tighter z-10">
                            {order.orderType === 'dine-in'
                                ? (order.tableId?.number || '?')
                                : (order.tokenNumber || '?')
                            }
                        </span>
                        <span className="text-[7px] xs:text-[9px] font-black uppercase tracking-[0.2em] xs:tracking-[0.25em] mt-1 xs:mt-2 opacity-60 z-10">
                            {order.orderType === 'dine-in' ? 'TABLE' : 'TOKEN'}
                        </span>
                    </div>

                    <div className="flex-1 flex flex-col gap-0.5 xs:gap-1 min-w-0">
                        <h2 className={`text-[18px] xs:text-[28px] font-black uppercase tracking-tighter truncate leading-none ${isPaid ? 'text-red-700' : 'text-[var(--theme-text-main)]'}`}>
                            {order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber || '').startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}
                        </h2>
                        
                        <div className="flex items-center gap-1.5 xs:gap-2.5 flex-wrap mt-1">
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 border border-[var(--theme-border)] rounded-lg xs:rounded-xl px-2 xs:px-3 py-0.5 xs:py-1">
                                <Utensils size={8} className="text-[var(--theme-text-muted)] xs:hidden" />
                                <Utensils size={10} className="text-[var(--theme-text-muted)] hidden xs:block" />
                                <span className="text-[9px] xs:text-[10px] font-black text-[var(--theme-text-main)] uppercase tracking-tight xs:tracking-wider whitespace-nowrap">
                                    {order.items?.filter(i => i.status?.toUpperCase() !== 'CANCELLED').length} Items
                                </span>
                            </div>
                            <span className={`px-2 xs:px-3 py-0.5 xs:py-1 rounded-lg xs:rounded-xl text-[9px] xs:text-[10px] font-black uppercase tracking-tight xs:tracking-wider border shadow-sm whitespace-nowrap ${isPaid ? 'bg-red-600 text-white border-red-700' : 'bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse-subtle'}`}>
                                {isPaid ? '• Paid' : '• Unpaid'}
                            </span>
                            <div className="flex items-center gap-1.5 text-[var(--theme-text-muted)] ml-auto bg-[var(--theme-bg-dark)]/30 px-2 xs:px-3 py-0.5 xs:py-1 rounded-lg xs:rounded-xl border border-[var(--theme-border)]/50">
                                <Clock size={9} strokeWidth={3} className="text-orange-500 xs:hidden" />
                                <Clock size={11} strokeWidth={3} className="text-orange-500 hidden xs:block" />
                                <span className="text-[9px] xs:text-[10px] font-black uppercase tracking-widest tabular-nums whitespace-nowrap">
                                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 xs:p-6 space-y-4 xs:space-y-6">
                {order.orderStatus !== 'ready' && !isCancelled && !isPaid && (
                    <div className="flex items-center gap-2 xs:gap-3 p-2.5 xs:p-3.5 rounded-xl xs:rounded-2xl border bg-orange-50/50 border-orange-200/50 dark:bg-orange-500/5 dark:border-orange-500/20">
                        <div className="w-8 h-8 xs:w-9 xs:h-9 rounded-lg xs:rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                            <Clock size={16} className="text-orange-500 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-[10px] xs:text-[11px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">
                                {order.isPartiallyReady ? 'New Items Added' : 'Kitchen Pipeline'}
                            </p>
                            <p className="text-[8px] xs:text-[9px] font-bold text-orange-500 opacity-70 uppercase tracking-wider">
                                {order.isPartiallyReady ? 'Awaiting Kitchen confirmation' : 'Order is being processed'}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col xs:flex-row bg-[var(--theme-bg-dark)]/40 rounded-[1.5rem] xs:rounded-[2rem] border border-[var(--theme-border)] shadow-xl overflow-hidden font-inter relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                    
                    <div className="w-full xs:w-[90px] sm:w-[120px] border-b xs:border-b-0 xs:border-r border-[var(--theme-border)]/50 flex flex-row xs:flex-col items-center justify-center p-3 xs:p-5 gap-4 xs:gap-0 z-10">
                         {/* Dynamic Role-Based Action Button */}
                         {(() => {
                             let icon = <Check size={28} />;
                             let label = "Served";
                             let nextStatus = null;
                             let colorClass = "bg-gray-100 dark:bg-white/5 border-[var(--theme-border)] text-[var(--theme-text-muted)] opacity-40 cursor-not-allowed grayscale";
                             let enabled = false;

                             if (userRole === 'waiter') {
                                 if (order.orderStatus === 'ready' || order.orderStatus === 'readyToServe') {
                                     label = "Served";
                                     nextStatus = "payment";
                                     icon = <Check size={28} strokeWidth={3} className="scale-75 xs:scale-100" />;
                                     colorClass = "bg-orange-600 border-orange-500 text-white shadow-[0_10px_25px_rgba(249,115,22,0.3)] hover:scale-105 active:scale-95";
                                     enabled = true;
                                 }
                             } else if (userRole === 'cashier' || userRole === 'admin') {
                                 if (order.orderStatus === 'payment') {
                                     label = "Done";
                                     nextStatus = "completed";
                                     icon = <CheckCircle size={28} strokeWidth={2.5} className="scale-75 xs:scale-100" />;
                                     colorClass = "bg-emerald-600 border-emerald-500 text-white shadow-[0_10px_25px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95";
                                     enabled = isPaid; // Only allow completion if paid
                                 }
                             }

                             // Override if already completed
                             if (order.orderStatus === 'completed') {
                                 label = "Done";
                                 icon = <CheckCircle size={28} strokeWidth={2.5} className="scale-75 xs:scale-100" />;
                                 colorClass = "bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20 opacity-40 cursor-default";
                                 enabled = false;
                                 nextStatus = null;
                             }

                             return (
                                 <>
                                    <button 
                                        disabled={isUpdatingStatus || !enabled}
                                        onClick={async () => {
                                            if (!nextStatus) return;
                                            try {
                                                setIsUpdatingStatus(true);
                                                if (onUpdateStatus) {
                                                    await onUpdateStatus(order._id, nextStatus);
                                                    if (nextStatus === 'completed') onClose();
                                                }
                                            } finally { setIsUpdatingStatus(false); }
                                        }}
                                        className={`w-10 h-10 xs:w-14 sm:w-16 xs:h-14 sm:h-16 rounded-[1.2rem] xs:rounded-[1.5rem] flex items-center justify-center transition-all duration-500 border-2 ${colorClass}`}
                                    >
                                        {isUpdatingStatus ? <Loader2 size={16} className="animate-spin" /> : icon}
                                    </button>
                                     <p className="mt-0 xs:mt-3 text-[8px] xs:text-[10px] font-black uppercase tracking-[0.15em] xs:tracking-[0.2em] text-[var(--theme-text-muted)] opacity-80 whitespace-nowrap">{label}</p>
                                 </>
                             );
                         })()}
                    </div>

                    <div className="flex-1 p-4 xs:p-7 flex flex-col justify-between min-w-0 z-10 overflow-hidden">
                        <div className="space-y-1.5 xs:space-y-2">
                            <div className="flex justify-between items-center px-1 xs:px-2 gap-2">
                                <span className="text-[10px] xs:text-[11px] font-black uppercase tracking-wider xs:tracking-[0.15em] text-[var(--theme-text-muted)] whitespace-nowrap">Subtotal</span>
                                <span className="text-[12px] xs:text-[14px] font-black tabular-nums text-[var(--theme-text-main)] whitespace-nowrap">{formatPrice(order.totalAmount)}</span>
                            </div>
                            
                            {(order.sgst > 0 || settings.sgst > 0) && (
                                <div className="flex justify-between items-center px-1 xs:px-2 gap-2 opacity-80">
                                    <span className="text-[10px] xs:text-[11px] font-black uppercase tracking-wider xs:tracking-[0.15em] text-[var(--theme-text-muted)] whitespace-nowrap">SGST {order.sgst === 0 && settings.sgst ? `(${settings.sgst}%)` : ''}</span>
                                    <span className="text-[12px] xs:text-[14px] font-black tabular-nums text-[var(--theme-text-main)] whitespace-nowrap">
                                        {order.sgst > 0 ? formatPrice(order.sgst) : formatPrice(order.totalAmount * settings.sgst / 100)}
                                    </span>
                                </div>
                            )}

                            {(order.cgst > 0 || settings.cgst > 0) && (
                                <div className="flex justify-between items-center px-1 xs:px-2 gap-2 opacity-80">
                                    <span className="text-[10px] xs:text-[11px] font-black uppercase tracking-wider xs:tracking-[0.15em] text-[var(--theme-text-muted)] whitespace-nowrap">CGST {order.cgst === 0 && settings.cgst ? `(${settings.cgst}%)` : ''}</span>
                                    <span className="text-[12px] xs:text-[14px] font-black tabular-nums text-[var(--theme-text-main)] whitespace-nowrap">
                                        {order.cgst > 0 ? formatPrice(order.cgst) : formatPrice(order.totalAmount * settings.cgst / 100)}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 xs:mt-7 pt-3 xs:pt-4 border-t border-[var(--theme-border)] flex justify-between items-end px-1 xs:px-2">
                            <div className="flex flex-col w-full overflow-hidden">
                                <span className="text-[10px] xs:text-[12px] font-black uppercase tracking-wider xs:tracking-[0.3em] text-orange-500 leading-none mb-1 xs:mb-2 whitespace-nowrap">Grand Total</span>
                                <div className="flex items-baseline gap-1 xs:gap-1.5 flex-wrap">
                                    <span className="text-xs xs:text-base font-black text-orange-500 opacity-60 leading-none">{formatPrice(order.finalAmount).replace(/[\d.,\s]/g, '')}</span>
                                    <span className="text-[24px] xs:text-[36px] font-black tracking-tighter leading-none tabular-nums text-[var(--theme-text-main)]">
                                        {formatPrice(order.finalAmount).replace(/[^\d.,]/g, '')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-[var(--theme-border)]">
                        <div className="flex flex-col">
                            <h3 className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-[0.2em]">Bill Items</h3>
                            <span className="text-[9px] font-bold text-orange-500 opacity-70 uppercase tracking-widest">{order.items?.filter(i => i.status?.toUpperCase() !== 'CANCELLED').length} Total</span>
                        </div>
                        <div className="flex items-center gap-1.5 xs:gap-2">
                            {!isCancelled && !isPaid && !isReady && !isPaymentOngoing && onCancelOrder && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onCancelOrder(order); }}
                                    className="px-2.5 xs:px-4 py-1.5 xs:py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-[9px] xs:text-[10px] font-black rounded-lg xs:rounded-xl border border-red-500/20 shadow-sm flex items-center gap-1.5 uppercase transition-all active:scale-95"
                                    title="Cancel Order"
                                >
                                    <X size={12} strokeWidth={3} /> <span className="hidden xs:inline">Cancel Order</span><span className="xs:hidden">Cancel</span>
                                </button>
                            )}
                            {userRole === 'waiter' && !isCancelled && !isPaid && !isPaymentOngoing && (
                                <button onClick={() => navigate('/dine-in', { state: { orderId: order._id } })} className="px-2.5 xs:px-4 py-1.5 xs:py-2 bg-orange-500 hover:bg-orange-600 text-white text-[9px] xs:text-[10px] font-black rounded-lg xs:rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-1.5 uppercase transition-all active:scale-95">
                                    <Plus size={12} strokeWidth={3} /> <span className="hidden xs:inline">Add Item</span><span className="xs:hidden">Add</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2 xs:space-y-2.5">
                        {order.items?.filter(i => i.status?.toUpperCase() !== 'CANCELLED').map((item, i) => {
                            const cancelled = item.status?.toUpperCase() === 'CANCELLED';
                            return (
                                <div key={item._id || i} className={`group flex items-center justify-between p-2.5 xs:p-3.5 rounded-xl xs:rounded-2xl border transition-all ${cancelled ? 'opacity-40 bg-[var(--theme-bg-dark)] border-dashed border-[var(--theme-border)]' : 'bg-white dark:bg-[var(--theme-bg-hover)] border-[var(--theme-border)] shadow-sm hover:shadow-md'}`}>
                                    <div className="flex items-center gap-2.5 xs:gap-3.5 flex-1 min-w-0">
                                        <div className="w-8 h-8 xs:w-10 xs:h-10 rounded-lg xs:rounded-xl flex items-center justify-center bg-gray-50 dark:bg-white/5 border border-[var(--theme-border)] shrink-0 shadow-inner">
                                            <span className="text-[11px] xs:text-xs font-black">{item.quantity}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="text-[13px] xs:text-[14px] font-black truncate text-[var(--theme-text-main)] leading-tight">{item.name}</p>
                                                {item.isNewlyAdded && (
                                                    <span className="bg-orange-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter animate-bounce shadow-sm">NEW</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-[9px] xs:text-[10px] font-bold text-[var(--theme-text-muted)] opacity-50 uppercase tracking-widest leading-none whitespace-nowrap">{formatPrice(item.price)}</span>
                                                {item.status && (
                                                    <span className={`text-[7px] xs:text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border whitespace-nowrap leading-none ${
                                                        item.status?.toUpperCase() === 'READY' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 
                                                        item.status?.toUpperCase() === 'CANCELLED' ? 'border-red-500/30 text-red-500 bg-red-500/5' : 
                                                        'border-orange-500/30 text-orange-500 bg-orange-500/5'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 xs:gap-4 ml-2">
                                        <p className="text-[13px] xs:text-[15px] font-black tabular-nums text-[var(--theme-text-main)] tracking-tight">{formatPrice(item.price * item.quantity)}</p>

                                        {(userRole === 'waiter' || userRole === 'admin') && onCancelItem && !cancelled && !isPaymentOngoing && (
                                            <button 
                                                disabled={item.status?.toUpperCase() !== 'PENDING'}
                                                onClick={() => onCancelItem(order, item)} 
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all 
                                                    ${item.status?.toUpperCase() === 'PENDING' 
                                                        ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white active:scale-90 shadow-sm border border-red-500/20' 
                                                        : 'bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-700 cursor-not-allowed grayscale'
                                                    }`}
                                                title={item.status?.toUpperCase() === 'PENDING' ? 'Cancel Item' : 'Already in Progress'}
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );

    if (variant === 'panel') {
        return (
            <div className="flex flex-col w-full h-full bg-[var(--theme-bg-card)]">
                <div className="flex-1 overflow-y-auto">{innerCard}</div>
                {(userRole !== 'waiter' || onProcessPayment) && (
                    <div className="p-5 border-t border-[var(--theme-border)] bg-[var(--theme-bg-dark)]/50 grid grid-cols-1 gap-3">
                        {userRole !== 'waiter' && (
                            <button 
                                disabled={isCancelled} 
                                onClick={() => setShowPrintConfirm(true)} 
                                className={`w-full h-14 flex items-center justify-center gap-3 rounded-[1.25rem] text-[13px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] ${
                                    isCancelled 
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                        : 'bg-white text-gray-900 border-2 border-gray-900 hover:bg-gray-900 hover:text-white shadow-gray-900/10'
                                }`}
                            >
                                <Printer size={18} strokeWidth={3} /> Print Bill
                            </button>
                        )}
                        {onProcessPayment && (
                            <button 
                                disabled={isCancelled || isPaid || !isReady} 
                                onClick={() => onProcessPayment(order)} 
                                className={`w-full h-14 flex items-center justify-center gap-3 rounded-[1.25rem] text-[13px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] ${
                                    isCancelled || isPaid || !isReady 
                                        ? 'bg-gray-100/50 text-[var(--theme-text-muted)] opacity-50 cursor-not-allowed border border-[var(--theme-border)]' 
                                        : 'bg-orange-600 text-white hover:bg-orange-500 shadow-[0_15px_35px_rgba(249,115,22,0.3)]'
                                }`}
                            >
                                <Banknote size={18} strokeWidth={3} /> {order.isPartiallyReady ? 'Kitchen Processing...' : isPaid ? 'Order Paid' : 'Complete Payment'}
                            </button>
                        )}
                    </div>
                )}
                {showPrintConfirm && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPrintConfirm(false)} />
                        <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col w-full max-w-[280px]">
                            <div className="p-8 flex flex-col items-center text-center text-black">
                                <Printer size={32} className="text-orange-500 mb-2" />
                                <h4 className="text-lg font-black uppercase tracking-tight">Print Ticket?</h4>
                                <p className="text-[10px] text-gray-500 font-bold uppercase">
                                    {order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber || '').startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 border-t border-gray-100">
                                <button onClick={() => setShowPrintConfirm(false)} className="h-14 text-[12px] text-gray-400 font-black uppercase border-r border-gray-100">No</button>
                                <button onClick={() => { printBill(order, formatPrice, settings); setShowPrintConfirm(false); }} className="h-14 text-[12px] text-orange-600 font-black uppercase">Print</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`fixed inset-0 z-[1000] flex items-center justify-center p-4 modal-overlay-p transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[6px]" onClick={onClose} />
            <div className={`
                relative z-10 w-full max-w-[440px] bg-[var(--theme-bg-card)] 
                rounded-[2.5rem] modal-rounded-mobile shadow-[0_45px_100px_-25px_rgba(0,0,0,0.6)] 
                flex flex-col max-h-[85vh] border border-[var(--theme-border)] 
                transition-all duration-500 ease-out
                ${isOpen ? 'translate-y-0 scale-100' : 'translate-y-12 scale-95 opacity-0'}
            `}>
                <div className="flex flex-col h-full overflow-hidden rounded-[2.5rem] modal-rounded-mobile">
                    {innerCard}
                    <div className={`
                        grid border-t border-[var(--theme-border)] bg-gray-50/50 dark:bg-black/5 flex-shrink-0 safe-bottom
                        ${userRole === 'waiter' && !onProcessPayment ? 'grid-cols-1' : 'grid-cols-2'}
                    `}>
                        <button onClick={onClose} className="h-16 flex items-center justify-center text-[12px] xs:text-[13px] text-[var(--theme-text-muted)] font-black uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-white/10 active:bg-gray-200 transition-colors border-r border-[var(--theme-border)]">Close</button>
                        {(userRole !== 'waiter' || onProcessPayment) && (
                            <button disabled={isCancelled || isPaid || !isReady} onClick={() => onProcessPayment ? onProcessPayment(order) : setShowPrintConfirm(true)} className={`h-16 flex items-center justify-center text-[12px] xs:text-[13px] font-black uppercase tracking-widest transition-all ${isCancelled || (onProcessPayment && (isPaid || !isReady)) ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed opacity-50' : (onProcessPayment ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10' : 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10')}`}>
                                {onProcessPayment ? (
                                    <div className="flex flex-col items-center">
                                        <Banknote size={18} strokeWidth={3} className="mb-0.5" />
                                        <span className="text-[9px] xs:text-[10px]">{order.isPartiallyReady ? 'Cooking...' : 'Pay Now'}</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <Printer size={18} strokeWidth={3} className="mb-0.5" />
                                        <span className="text-[9px] xs:text-[10px]">Print Bill</span>
                                    </div>
                                )}
                            </button>
                        )}
                    </div>
                </div>
                {showPrintConfirm && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-scale-in">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[4px]" onClick={() => setShowPrintConfirm(false)} />
                        <div className="relative bg-white rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col w-full max-w-[260px]">
                            <div className="p-6 flex flex-col items-center text-center gap-1.5 text-black">
                                <h4 className="text-[17px] font-black uppercase tracking-tight">Print Ticket?</h4>
                                <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">
                                    {order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber || '').startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 border-t border-gray-100">
                                <button onClick={() => setShowPrintConfirm(false)} className="h-14 text-[12px] text-gray-400 font-black uppercase border-r border-gray-100">No</button>
                                <button onClick={() => { printBill(order, formatPrice, settings); setShowPrintConfirm(false); }} className="h-14 text-[12px] text-orange-600 font-black uppercase">Print</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderDetailsModal;
