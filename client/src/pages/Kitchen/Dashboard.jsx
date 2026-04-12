import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import { getCachedOrders, getPendingOrders } from '../../db/db';
import { ChefHat, Clock, CheckCheck, Utensils, XCircle, Grid, List, Loader2, ChevronRight, ChevronLeft, RefreshCw, X } from 'lucide-react';
import CancelOrderModal from '../../components/CancelOrderModal';
import OrderDetailsModal from '../../components/OrderDetailsModal';
import StatusBadge from '../../components/StatusBadge';
import { tokenColors } from '../../utils/tokenColors';


/* ── Time since order ────────────────────────────────────────────────────── */
const useElapsed = (createdAt) => {
    const [elapsed, setElapsed] = useState('');
    useEffect(() => {
        const calc = () => {
            const diff = Math.floor((Date.now() - new Date(createdAt)) / 1000);
            if (diff < 60) { setElapsed(`${diff}s`); return; }
            const minutes = Math.floor(diff / 60);
            if (minutes < 60) { setElapsed(`${minutes}m ${diff % 60}s`); return; }
            const hours = Math.floor(minutes / 60);
            if (hours < 24) { setElapsed(`${hours}h ${minutes % 60}m`); return; }
            const days = Math.floor(hours / 24);
            if (days < 30) { setElapsed(`${days}d ${hours % 24}h`); return; }
            const months = Math.floor(days / 30);
            if (months < 12) { setElapsed(`${months}mo ${days % 30}d`); return; }
            setElapsed(`${Math.floor(months / 12)}y ${months % 12}mo`);
        };
        calc();
        const id = setInterval(calc, 1000);
        return () => clearInterval(id);
    }, [createdAt]);
    return elapsed;
};

/* ── Inline timer cell for table rows ───────────────────────────────────── */
const KitchenTimer = ({ createdAt, urgency }) => {
    const elapsed = useElapsed(createdAt);
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${urgency ? 'text-red-600 bg-red-100 px-2 py-0.5 rounded-md' : 'text-gray-400'}`}>
            <Clock size={11} />{elapsed}
        </span>
    );
};

/* ── KOT Ticket Card ─────────────────────────────────────────────────────── */
const KotTicket = ({ order, onUpdateStatus, onUpdateItemStatus, onCancel, onCancelItem, userRole, viewType = 'normal' }) => {
    const [isMarkingAll, setIsMarkingAll] = useState(false);
    const [loadingItems, setLoadingItems] = useState({});
    const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
    const isList = viewType === 'list';
    const elapsed = useElapsed(order.createdAt);
    const urgency = (Date.now() - new Date(order.createdAt)) > 600000;
    const tColor = tokenColors[order.orderStatus] || 'bg-[var(--theme-bg-card)] border-[var(--theme-border)]';
    const isReady = order.orderStatus?.toLowerCase() === 'ready';
    const hasNewItems = order.items?.some(i => i.isNewlyAdded && i.status?.toUpperCase() === 'PENDING');
    const isPaid = order.paymentStatus === 'paid';

    const borderColor =
        order.paymentStatus === 'paid'         ? 'border-red-500' :
        hasNewItems                          ? 'border-[var(--status-pending)]' :
        order.orderStatus === 'pending'      ? 'border-[var(--status-pending)]' :
        order.orderStatus === 'accepted'     ? 'border-[var(--status-accepted)]' :
        order.orderStatus === 'preparing'    ? 'border-[var(--status-preparing)]' :
        order.orderStatus === 'ready'        ? 'border-[var(--status-ready)]' :
        'border-[var(--theme-border)]';

    /* ── LIST ROW ───────────────────────────────────────────────────────── */
    if (isList) {
        const itemsSummary = order.items
            .filter(i => i.status?.toUpperCase() !== 'CANCELLED')
            .map(i => `${i.quantity} ${i.name}${i.variant ? ` (${i.variant.name})` : ''}`)
            .join(', ');
        return (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-l-[6px] shadow-sm transition-all animate-fade-in ${tColor} ${borderColor} ${urgency ? 'ring-1 ring-red-500/30' : ''}`}>
                <div className="w-32 shrink-0">
                    <p className="text-sm font-black text-gray-900 leading-none">{order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/50 border border-black/10 rounded-lg text-[10px] font-black text-gray-900">
                            <Utensils size={9} />
                            {order.orderType === 'dine-in' ? `T ${order.tableId?.number || order.tableId || '?'}` : `TK ${order.tokenNumber}`}
                        </span>
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{itemsSummary || 'No items'}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">
                        {order.orderType === 'dine-in' ? 'Dine-In' : 'Takeaway'} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className={`shrink-0 flex items-center gap-1 text-[11px] font-bold ${urgency ? 'text-red-600 bg-red-100 px-2 py-0.5 rounded-md' : 'text-gray-400'}`}>
                    <Clock size={11} />{elapsed}
                </div>
                <div className="shrink-0"><StatusBadge status={order.orderStatus} items={order.items || []} size="sm" /></div>
                {(userRole === 'kitchen' || userRole === 'admin') && (
                    <div className="shrink-0 flex items-center gap-1">
                        {/* Single Step: MARK READY */}
                        {order.orderStatus === 'pending' && (
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if(isUpdatingOrder) return;
                                    setIsUpdatingOrder(true);
                                    try { await onUpdateStatus(order._id, 'ready'); } finally { setIsUpdatingOrder(false); }
                                }} disabled={isUpdatingOrder} className="px-5 flex items-center justify-center min-w-[80px] h-9 text-white text-[11px] font-black rounded-xl active:scale-95 transition-all bg-emerald-600 shadow-lg shadow-emerald-500/20">
                                {isUpdatingOrder ? <Loader2 size={14} className="animate-spin" /> : 'MARK READY ✓'}
                            </button>
                        )}
                        {order.orderStatus !== 'completed' && order.orderStatus !== 'cancelled' && (order.orderStatus !== 'ready' || userRole === 'admin') && (
                            <button onClick={(e) => { e.stopPropagation(); onCancel(order); }} className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400 transition-all"><XCircle size={15} /></button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    /* ── CARD (box style - matches requested grid view) ───────────────── */
    return (
        <div className={`
            relative flex flex-col rounded-2xl border shadow-sm transition-all duration-300 animate-fade-in overflow-hidden h-full
            bg-[var(--theme-bg-card)] border-[var(--theme-border)]
            ${hasNewItems ? 'ring-2 ring-orange-500/50 scale-[1.02] z-10' : ''}
            ${urgency && !isReady ? 'ring-2 ring-red-500/50' : ''}
        `}>
            {/* Urgency/Status indicator strip at the very top */}
            <div className={`h-1.5 w-full ${borderColor} bg-current opacity-20`} />

            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="px-3 py-3 border-b border-[var(--theme-border)]">
                {/* Row 1: order number + status badge */}
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[14px] font-black text-[var(--theme-text-main)] tracking-tight italic">
                        {order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}
                    </h3>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        {hasNewItems && <span className="text-[8px] font-black bg-orange-50 text-orange-600 border border-orange-200/50 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">+New</span>}
                        <StatusBadge status={order.orderStatus} items={order.items || []} size="xs" />
                    </div>
                </div>
                {/* Row 2: Token/Table + timer */}
                <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/5 border border-orange-500/10 rounded-lg text-[10px] font-black text-orange-600 truncate max-w-[60%]">
                        <Utensils size={9} />
                        {order.orderType === 'dine-in' ? `T ${order.tableId?.number || order.tableId || '?'}` : `TK ${order.tokenNumber || '?'}`}
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] font-bold shrink-0 ${urgency ? 'text-red-500 animate-pulse' : 'text-[var(--theme-text-muted)]'}`}>
                        <Clock size={10} strokeWidth={3} />
                        {elapsed}
                    </div>
                </div>
            </div>

            {/* ── Items ─────────────────────────────────────────────────── */}
            <div className="flex-1 px-3 py-2.5 space-y-2 overflow-y-auto custom-scrollbar min-h-[60px] max-h-[220px]">
                {/* ACTIVE ITEMS */}
                {order.items.filter(i => i.status?.toUpperCase() !== 'READY' && i.status?.toUpperCase() !== 'CANCELLED').map(item => (
                    <div key={item._id} className="flex items-start gap-1.5 group">
                        <div className="w-4 h-4 shrink-0 rounded flex items-center justify-center text-[10px] font-black bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] border border-[var(--theme-border)] mt-0.5">
                            {item.quantity}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] sm:text-[12px] font-bold text-[var(--theme-text-main)] leading-tight tracking-tight">
                                {item.name}
                                {item.variant?.name && <span className="ml-1 text-[8px] opacity-60">({item.variant.name})</span>}
                            </p>
                        </div>
                        {userRole === 'kitchen' || userRole === 'admin' ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); onCancelItem(order, item); }}
                                className="w-5 h-5 shrink-0 flex items-center justify-center rounded hover:bg-red-500/15 text-red-400/50 hover:text-red-500 transition-all"
                                title="Cancel item"
                            >
                                <XCircle size={12} />
                            </button>
                        ) : null}
                    </div>
                ))}

                {/* COMPLETED ITEMS (Streamlined) */}
                {order.items.some(i => i.status?.toUpperCase() === 'READY') && (
                    <div className="mt-2 pt-2 border-t border-dashed border-[var(--theme-border)] opacity-60">
                        <p className="text-[8px] font-black text-emerald-600 mb-1.5 tracking-widest uppercase">✓ Completed</p>
                        <div className="space-y-1">
                            {order.items.filter(i => i.status?.toUpperCase() === 'READY').map(item => (
                                <div key={item._id} className="flex items-center gap-2 text-[10px] font-medium text-[var(--theme-text-muted)]">
                                    <span className="w-3.5 h-3.5 flex items-center justify-center bg-emerald-500/10 text-emerald-600 text-[8px] font-black rounded ring-1 ring-emerald-500/20">{item.quantity}</span>
                                    <span className="line-through">{item.name}</span>
                                    <span className="w-4 h-4 shrink-0 flex items-center justify-center text-gray-300" title="Cannot cancel - already ready">
                                        <XCircle size={10} />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <div className="px-3 py-2 border-t border-[var(--theme-border)] bg-[var(--theme-bg-hover)] mt-auto flex items-center justify-between gap-2 overflow-hidden">
                <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-tighter shrink-0 opacity-60">
                    {order.orderType === 'dine-in' ? 'DINE' : 'TAKE'}
                </span>
                
                <div className="flex items-center gap-1.5 min-w-0">
                    {(userRole === 'kitchen' || userRole === 'admin') && 
                     ['pending', 'accepted', 'preparing'].includes(order.orderStatus?.toLowerCase()) ? (
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (isUpdatingOrder) return;
                                setIsUpdatingOrder(true);
                                try { await onUpdateStatus(order._id, 'ready'); } finally { setIsUpdatingOrder(false); }
                            }}
                            disabled={isUpdatingOrder}
                            className={`px-3 py-1 flex items-center justify-center min-w-[60px] h-7 text-white text-[10px] font-black rounded-lg shadow-sm transition-all active:scale-95 uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 ${isUpdatingOrder ? 'opacity-30' : ''}`}
                        >
                            {isUpdatingOrder ? <Loader2 size={12} className="animate-spin" /> : 'READY'}
                        </button>
                    ) : null}
                    
                    {order.orderStatus !== 'completed' && order.orderStatus !== 'cancelled' &&
                     order.orderStatus !== 'ready' && (userRole === 'kitchen' || userRole === 'admin') && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onCancel(order); }}
                            className="w-7 h-7 flex items-center justify-center hover:bg-red-500/15 rounded-lg text-red-500/50 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20 shrink-0"
                        >
                            <XCircle size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ── Kitchen Token Card (Compact Mode) ─────────────────────────────────── */
const KitchenTokenCard = ({ order, onClick }) => {
    const urgency = (Date.now() - new Date(order.createdAt)) > 600000;
    const isReady = order.orderStatus?.toLowerCase() === 'ready';
    const sColor =
        order.orderStatus === 'pending'   ? 'bg-orange-500/10 border-orange-500 text-orange-600' :
        order.orderStatus === 'ready'     ? 'bg-emerald-600/10 border-emerald-500 text-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.3)]' :
        'bg-gray-500/10 border-gray-500 text-gray-500';

    const [isUpdating, setIsUpdating] = useState(false);

    const handleAdvance = async (e) => {
        e.stopPropagation();
        if (isUpdating || order.orderStatus === 'ready') return;
        setIsUpdating(true);
        try { await onClick(order, 'ready'); } 
        finally { setIsUpdating(false); }
    };

    const itemCount = order.items?.filter(i => i.status?.toUpperCase() !== 'CANCELLED').length || 0;
    const time = order.createdAt
        ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    return (
        <button
            onClick={onClick}
            className={`w-full min-h-[100px] h-[100px] sm:min-h-[120px] sm:h-[120px] max-w-[150px] mx-auto rounded-2xl border-2 flex flex-col items-center justify-between p-2.5 sm:p-3 transition-all hover:-translate-y-0.5 active:scale-95 shadow-sm overflow-hidden group relative
                ${sColor} ${isReady ? 'animate-pulse' : ''} ${urgency ? 'ring-2 ring-red-500/50' : ''}`}
        >
            {/* Top row */}
            <div className="flex items-start justify-between w-full shrink-0 relative">
                <div className="flex flex-col items-start gap-1">
                    <span className="text-[8px] sm:text-[9px] uppercase font-black opacity-50 tracking-wider">
                        {order.orderType === 'dine-in' ? 'Dine' : 'Take'}
                    </span>
                    {order.isPartiallyReady && (
                        <span className="text-[7px] font-black uppercase bg-orange-50 text-orange-600 border border-orange-200/50 px-2 py-0.5 rounded-full shadow-sm animate-bounce-subtle">
                            Partial
                        </span>
                    )}
                </div>
                <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded border border-current/30 bg-white/10 shrink-0">
                    {order.orderStatus}
                </span>
                {/* floating order # */}
                <span className="absolute top-6 -left-0.5 text-[7px] font-black opacity-30 tracking-tight leading-none pointer-events-none">{order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}</span>
            </div>

            {/* Acceptance Icon (Floating Status Advancer) */}
            {!isReady && !isUpdating && (
                <div 
                    onClick={handleAdvance}
                    className="absolute bottom-1 right-1 w-6 h-6 rounded-lg flex items-center justify-center text-white shadow-lg active:scale-125 transition-all z-20 border border-white/20 bg-emerald-600"
                >
                    <CheckCheck size={12} strokeWidth={4} />
                </div>
            )}
            {isUpdating && (
                <div className="absolute bottom-1 right-1 w-6 h-6 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center animate-spin z-20">
                    <Loader2 size={11} className="text-white" />
                </div>
            )}

            {/* Middle big identifier */}
            <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0 pt-2" onClick={e => e.stopPropagation()}>
                <span className="text-xl sm:text-2xl font-black leading-none tracking-tight text-center px-1 break-words w-full truncate group-hover:scale-105 transition-transform">
                    {order.orderType === 'dine-in'
                        ? `T ${order.tableId?.number || order.tableId || '?'}`
                        : `TK ${order.tokenNumber || '?'}`}
                </span>
            </div>

            {/* Bottom details */}
            <div className="flex items-center justify-between w-full opacity-60 text-[7px] sm:text-[8px] font-bold shrink-0 mt-auto">
                <span className="truncate pr-1">{itemCount} items</span>
                <span className="whitespace-nowrap">{time}</span>
            </div>
        </button>
    );
};

/* ── Main Screen ─────────────────────────────────────────────────────────── */
const KitchenDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const activeTab = searchParams.get('tab') || 'active'; // 'active', 'cancelled', 'completed'
    const [filterType, setFilterType] = useState('all'); // 'all', 'dine-in', 'takeaway'
    const [statusFilter, setStatusFilter] = useState(null);
    const [, setLastRefresh] = useState(new Date());
    const [cancelModal, setCancelModal] = useState({ isOpen: false, order: null, item: null });
    const [detailsModal, setDetailsModal] = useState({ isOpen: false, order: null });
    const [isCardView, setIsCardView] = useState(() => localStorage.getItem('kitchenCardView') === 'true');
    const [showTables, setShowTables] = useState(false);
    const { user, socket, settings, formatOrderNumber } = useContext(AuthContext);
    const announcedOrders = useRef(new Set());
    const isFirstLoad = useRef(true);

    // ── Voice Announcement Logic ───────────────────────────────────────────
    useEffect(() => {
        if (loading || !orders.length) return;

        // On first load, record existing 'ready' takeaways to suppress announcement
        if (isFirstLoad.current) {
            orders.forEach(o => {
                if (o.orderStatus?.toLowerCase() === 'ready' && o.orderType === 'takeaway') {
                    announcedOrders.current.add(o._id);
                }
            });
            isFirstLoad.current = false;
            return;
        }

        // Identify takeaway orders that just transitioned to 'ready'
        const newlyReadyTakeaways = orders.filter(o => 
            o.orderType === 'takeaway' && 
            o.orderStatus?.toLowerCase() === 'ready' && 
            !announcedOrders.current.has(o._id)
        );

        if (newlyReadyTakeaways.length > 0) {
            newlyReadyTakeaways.forEach(o => {
                announcedOrders.current.add(o._id);
                
                const token = o.tokenNumber || 'Unknown';
                const itemsCount = o.items?.reduce((sum, item) => 
                    sum + (item.status?.toUpperCase() !== 'CANCELLED' ? (item.quantity || 1) : 0), 0) || 0;
                
                const text = `Token ${token}, ${itemsCount} items, takeaway order ready`;
                
                // Slight delay and then speak as requested
                setTimeout(() => {
                    if (!('speechSynthesis' in window)) return;
                    const speech = new SpeechSynthesisUtterance(text);
                    speech.lang = "en-IN";
                    speech.rate = 1;
                    speech.pitch = 1;
                    window.speechSynthesis.speak(speech);
                }, 400);
            });
        }
    }, [orders, loading]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        if (!navigator.onLine) {
            const [cached, pending] = await Promise.all([
                getCachedOrders(),
                getPendingOrders()
            ]);
            const allOrders = [...(pending || []), ...(cached || [])];
            setOrders(allOrders);
            setLastRefresh(new Date());
            setLoading(false);
            return;
        }
        try {
            const res = await api.get('/api/orders', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setOrders(res.data.orders || []);
            setLastRefresh(new Date());
        } catch (err) {
            console.error('Kitchen fetch error', err);
            const cached = await getCachedOrders();
            setOrders(cached || []);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;

        fetchOrders();

        if (socket) {
            const onNewOrder = (order) => {
                setOrders(prev => {
                    if (prev.find(o => o._id === order._id)) return prev;
                    return [order, ...prev];
                });
            };

            const onUpdateOrder = (order) => {
                setOrders(prev => {
                    const exists = prev.find(o => o._id === order._id);
                    if (exists) {
                        return prev.map(o => o._id === order._id ? order : o);
                    } else {
                        return [order, ...prev];
                    }
                });
                if (detailsModal.isOpen && detailsModal.order?._id === order._id && 
                    (order.orderStatus === 'completed' || order.orderStatus === 'cancelled' || order.kotStatus === 'Closed')) {
                    setDetailsModal({ isOpen: false, order: null });
                }
            };

            const onCancelled = (order) => {
                setOrders(prev => prev.map(o => o._id === order._id ? order : o));
                if (detailsModal.isOpen && detailsModal.order?._id === order._id) {
                    setDetailsModal({ isOpen: false, order: null });
                }
            };

            socket.on('new-order', onNewOrder);
            socket.on('order-updated', onUpdateOrder);
            socket.on('order-completed', onUpdateOrder);
            socket.on('orderCancelled', onCancelled);
            socket.on('itemUpdated', onUpdateOrder);

            return () => {
                socket.off('new-order', onNewOrder);
                socket.off('order-updated', onUpdateOrder);
                socket.off('order-completed', onUpdateOrder);
                socket.off('orderCancelled', onCancelled);
                socket.off('itemUpdated', onUpdateOrder);
            };
        }
        window.addEventListener('pos-refresh', fetchOrders);
        return () => window.removeEventListener('pos-refresh', fetchOrders);
    }, [user, socket, fetchOrders]);


    const updateStatus = async (orderId, newStatus) => {
        if (user.role !== 'kitchen' && user.role !== 'admin') return;
        try {
            await api.put(`/api/orders/${orderId}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
        } catch (err) {
            console.error('updateStatus failed:', err.response?.data?.message || err.message, err.response?.data);
        }
    };

    const updateItemStatus = async (orderId, itemId, newStatus) => {
        if (user.role !== 'kitchen' && user.role !== 'admin') return;
        try {
            await api.put(`/api/orders/${orderId}/items/${itemId}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
        } catch (err) {
            console.error('updateItemStatus failed:', err.response?.data?.message || err.message, err.response?.data);
        }
    };

    const handleCancelAction = async (orderId, arg2, arg3) => {
        const isItem = arg3 !== undefined;
        const url = isItem
            ? `/api/orders/${orderId}/items/${arg2}/cancel`
            : `/api/orders/${orderId}/cancel`;
        const reason = isItem ? arg3 : arg2;
        // Let the error propagate — CancelOrderModal catches it, shows the message,
        // and keeps the modal open so the user knows the action failed.
        await api.put(url, { reason }, { headers: { Authorization: `Bearer ${user.token}` } });
    };

    const ACTIVE_STATUSES = ['pending', 'ready'];
    // Only count orders that are actually visible in the kitchen display (kotStatus not Closed)
    const activeKotOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.orderStatus) && o.kotStatus !== 'Closed');

    const counts = {
        pending: activeKotOrders.filter(o => o.orderStatus === 'pending').length,
        ready: orders.filter(o => o.orderStatus === 'ready').length,
        cancelled: orders.filter(o => o.orderStatus === 'cancelled').length,
        completed: orders.filter(o => o.orderStatus === 'completed').length,
    };
    const displayOrders = (activeTab === 'active'
        ? activeKotOrders
        : activeTab === 'cancelled'
            ? orders.filter(o => o.orderStatus === 'cancelled')
            : orders.filter(o => o.orderStatus === 'completed' || o.orderStatus === 'ready')
    )

    .filter(o => settings?.takeawayEnabled !== false || o.orderType !== 'takeaway')
    .filter(o => settings?.dineInEnabled   !== false || o.orderType !== 'dine-in')
    .filter(o => {
        const matchesType = filterType === 'all' || o.orderType === filterType;
        const matchesStatus = !statusFilter || o.orderStatus === statusFilter;
        return matchesType && matchesStatus;
    });

    return (
        <div className="flex flex-col gap-3 animate-fade-in pb-0 text-left flex-1 overflow-hidden min-h-0 h-full pt-2">

            {/* ── Portal: TopBar Utilities ── */}
            {document.getElementById('topbar-portal') && createPortal(
                <div className="flex items-center justify-between w-full animate-fade-in px-1 gap-1.5">
                    {/* Filters - Desktop/Tab only (Responsive labels for Mini-Tab) */}
                    <div className="hidden md:flex items-center gap-1 p-1 bg-[var(--theme-bg-dark)] border border-[var(--theme-border)] rounded-2xl shadow-sm">
                        {['all', 'dine-in', 'takeaway']
                            .filter(t => t !== 'takeaway' || settings?.takeawayEnabled !== false)
                            .filter(t => t !== 'dine-in' || settings?.dineInEnabled !== false)
                            .map(t => (
                                <button
                                    key={t}
                                    onClick={() => setFilterType(t)}
                                    className={`px-3 lg:px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                                        filterType === t 
                                            ? 'bg-orange-600 text-white shadow-md' 
                                            : 'text-[var(--theme-text-muted)] hover:text-orange-500'
                                    }`}
                                >
                                    <span className="md:hidden lg:inline">{t === 'all' ? 'All Orders' : t === 'dine-in' ? 'Dine-In' : 'Takeaway'}</span>
                                    <span className="hidden md:inline lg:hidden">{t === 'all' ? 'All' : t === 'dine-in' ? 'Dine' : 'Take'}</span>
                                </button>
                            ))
                        }
                    </div>

                    <div className="flex items-center gap-1 xs:gap-1.5 shrink-0 ml-auto">
                        <button
                            onClick={() => setShowTables(!showTables)}
                            title={showTables ? "Collapse Stats" : "Expand Stats"}
                            className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl border transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 relative overflow-hidden group ${
                                showTables 
                                    ? 'bg-orange-500 border-orange-400 text-white shadow-md ring-2 ring-orange-500/20' 
                                    : 'bg-[var(--theme-bg-dark)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-orange-500'
                            }`}
                        >
                            <ChevronLeft 
                                size={16} 
                                strokeWidth={3} 
                                className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                                    showTables ? 'rotate-180 scale-110' : 'rotate-0'
                                }`} 
                            />
                        </button>

                        <div className="flex items-center p-0.5 rounded-xl bg-[var(--theme-bg-hover)] border border-[var(--theme-border)] gap-0.5">
                            <button
                                onClick={() => { setIsCardView(true); localStorage.setItem('kitchenCardView', true); }}
                                className={`w-8 h-8 md:w-auto md:px-2 lg:px-3 md:py-1.5 flex items-center justify-center rounded-lg transition-all ${isCardView ? 'bg-blue-600 text-white shadow-md' : 'text-[var(--theme-text-muted)]'}`}
                            >
                                <Grid size={13} strokeWidth={2.5} />
                                <span className="hidden lg:inline ml-1.5 text-[10px] font-black uppercase">Card</span>
                            </button>
                            <button
                                onClick={() => { setIsCardView(false); localStorage.setItem('kitchenCardView', false); }}
                                className={`w-8 h-8 md:w-auto md:px-2 lg:px-3 md:py-1.5 flex items-center justify-center rounded-lg transition-all ${!isCardView ? 'bg-orange-500 text-white shadow-md' : 'text-[var(--theme-text-muted)]'}`}
                            >
                                <List size={13} strokeWidth={2.5} />
                                <span className="hidden lg:inline ml-1.5 text-[10px] font-black uppercase">List</span>
                            </button>
                        </div>

                    </div>
                </div>,
                document.getElementById('topbar-portal')
            )}

            {/* ── Row 1: Filters (Hidden on md+ as moved to TopBar) ── */}
            <div className="flex md:hidden items-center w-full px-1 animate-fade-in shrink-0">
                <div className="grid grid-cols-3 w-full gap-1 p-1 bg-[var(--theme-bg-hover)] rounded-2xl border border-[var(--theme-border)] shadow-sm">
                    {['all', 'dine-in', 'takeaway']
                        .filter(t => t !== 'takeaway' || settings?.takeawayEnabled !== false)
                        .filter(t => t !== 'dine-in' || settings?.dineInEnabled !== false)
                        .map(t => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t)}
                                className={`flex items-center justify-center py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                                    filterType === t 
                                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20' 
                                        : 'text-[var(--theme-text-muted)] hover:text-orange-500'
                                }`}
                            >
                                {t === 'all' ? 'All' : t === 'dine-in' ? 'Dine' : 'Take'}
                            </button>
                        ))}
                </div>
            </div>


            {/* ── Row 2: Stats Grid (Slide-down) ── */}



            {/* ── Status View (Slide-down Counters) ───────────────────── */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showTables ? 'max-h-[200px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[var(--theme-bg-card)] p-3 rounded-2xl border-2 border-[var(--theme-border)] shadow-xl">
                        { [
                            { key: 'pending', count: counts.pending, dot: 'bg-amber-500', label: 'New KOT', activeColor: 'text-amber-500', activeBg: 'bg-amber-500/10' },
                            { key: 'ready', count: counts.ready, dot: 'bg-emerald-500', label: 'Ready', activeColor: 'text-emerald-500', activeBg: 'bg-emerald-500/10' },
                        ].map(({ key, count, dot, label, activeColor, activeBg }, idx) => (
                        <button 
                            key={key} 
                            onClick={() => setStatusFilter(f => f === key ? null : key)} 
                            style={{ animationDelay: `${idx * 0.05}s`, animationFillMode: 'backwards' }}
                            className={`group rounded-xl p-2.5 sm:p-3 flex flex-col items-center justify-center transition-all duration-300 border animate-in fade-in zoom-in-95 slide-in-from-top-2 ${
                                statusFilter === key ? `${activeBg} border-transparent shadow-sm scale-95` : 'bg-[var(--theme-bg-dark)] border-[var(--theme-border)] hover:border-orange-500/30'
                            }`}
                        >
                            <p className={`text-lg sm:text-2xl font-black tabular-nums ${statusFilter === key ? activeColor : 'text-[var(--theme-text-main)]'}`}>{count}</p>
                            <div className="flex items-center gap-1 mt-1">
                                <div className={`flex items-center -ml-0.5 scale-[1.01] ${statusFilter === key ? activeColor : dot.replace('bg-', 'text-')}`}>
                                    <ChevronRight size={12} strokeWidth={4} className="animate-chevron-r1" />
                                    <ChevronRight size={12} strokeWidth={4} className="-ml-1.5 opacity-60 animate-chevron-r2" />
                                    <ChevronRight size={12} strokeWidth={4} className="-ml-1.5 opacity-20 animate-chevron-r3" />
                                </div>
                                <p className={`text-[8px] sm:text-[10px] ml-0.5 uppercase font-bold tracking-wider ${statusFilter === key ? activeColor : 'text-[var(--theme-text-muted)]'}`}>{label}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── KOT Grid — Isolated Scroll Container ──────────────── */}
            <div className="flex-1 min-h-0 kot-scroll rounded-2xl">
            {loading ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                    {Array(8).fill(0).map((_, i) => <div key={i} className="skeleton rounded-xl h-48" />)}
                </div>
            ) : displayOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-text-muted)]">
                    {activeTab === 'active' ? (
                        <>
                            <ChefHat size={44} className="mb-2 opacity-20" />
                            <h3 className="text-base font-extrabold text-[var(--theme-text-muted)]">Kitchen is clear!</h3>
                            <p className="text-xs mt-1 opacity-70 tracking-tight">No open KOTs in the queue</p>
                        </>
                    ) : activeTab === 'cancelled' ? (
                        <>
                            <ChefHat size={56} className="mb-4 opacity-20" />
                            <h3 className="text-xl font-bold text-[var(--theme-text-muted)]">No cancellations</h3>
                            <p className="text-sm mt-1">Everything is running smoothly</p>
                        </>
                    ) : (
                        <>
                            <ChefHat size={56} className="mb-4 opacity-20" />
                            <h3 className="text-xl font-bold text-[var(--theme-text-muted)]">No completed orders</h3>
                            <p className="text-sm mt-1">Completed orders will appear here</p>
                        </>
                    )}
                </div>
            ) : (
                <div className={`grid p-2 sm:p-5 pb-32 animate-fade-in ${
                    isCardView
                        ? 'grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2'
                        : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-2.5 sm:gap-5'
                }`}>
                    {displayOrders.map(order => (
                        <div key={order._id} className="h-full transition-transform">
                            {isCardView ? (
                                <KitchenTokenCard
                                    order={order}
                                    onClick={(o, s) => s && updateStatus(o._id, s)}
                                />
                            ) : (
                                <div className="h-full">
                                    <KotTicket
                                        order={order}
                                        onUpdateStatus={updateStatus}
                                        onUpdateItemStatus={updateItemStatus}
                                        onCancel={(o) => setCancelModal({ isOpen: true, order: o, item: null })}
                                        onCancelItem={(o, i) => setCancelModal({ isOpen: true, order: o, item: i })}
                                        userRole={user.role}
                                        viewType="normal"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            </div>
    
                <OrderDetailsModal
                    order={detailsModal.order}
                    isOpen={detailsModal.isOpen}
                    onClose={() => setDetailsModal({ isOpen: false, order: null })}
                    formatPrice={(p) => `${settings.currencySymbol || '₹'}${p}`}
                    onCancelItem={(o, i) => {
                        setDetailsModal({ isOpen: false, order: null });
                        setCancelModal({ isOpen: true, order: o, item: i });
                    }}
                    onCancelOrder={(o) => {
                        setDetailsModal({ isOpen: false, order: null });
                        setCancelModal({ isOpen: true, order: o, item: null });
                    }}
                    userRole={user.role}
                    settings={settings}
                />
    
                <CancelOrderModal
                    isOpen={cancelModal.isOpen}
                    order={cancelModal.order}
                    item={cancelModal.item}
                    title={cancelModal.item ? "Cancel Item" : "Cancel Order"}
                    onClose={() => setCancelModal({ isOpen: false, order: null, item: null })}
                    onConfirm={handleCancelAction}
                />
    

            </div>
        );
    };
    
    export default KitchenDashboard;
    
