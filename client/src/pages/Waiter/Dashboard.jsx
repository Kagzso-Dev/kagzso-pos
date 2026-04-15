import { useState, useEffect, useContext, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';
import { queueAction } from '../../utils/syncEngine';
import { Utensils, Package, Grid, List, ShoppingBag, Clock, History, WifiOff, ChevronRight, ChevronLeft, RefreshCw, X, Armchair, LogOut, Grid2X2 } from 'lucide-react';
import TableGrid from '../../components/TableGrid';
import CancelOrderModal from '../../components/CancelOrderModal';
import OrderDetailsModal from '../../components/OrderDetailsModal';
import StatusBadge from '../../components/StatusBadge';
import NotificationBell from '../../components/NotificationBell';

/* ── Elapsed time hook ───────────────────────────────────────────────────── */
const useElapsed = (createdAt) => {
    const [elapsed, setElapsed] = useState('');
    useEffect(() => {
        const calc = () => {
            const diff = Math.floor((Date.now() - new Date(createdAt)) / 1000);
            if (diff < 60) { setElapsed(`${diff}s`); return; }
            const m = Math.floor(diff / 60);
            if (m < 60) { setElapsed(`${m}m ${diff % 60}s`); return; }
            const h = Math.floor(m / 60);
            if (h < 24) { setElapsed(`${h}h ${m % 60}m`); return; }
            const days = Math.floor(h / 24);
            if (days < 30) { setElapsed(`${days}d ${h % 24}h`); return; }
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

/* ── KOT-style Box Card (Waiter) ─────────────────────────────────────────── */
const WaiterBoxCard = memo(({ order, formatPrice }) => {
    const elapsed = useElapsed(order.createdAt);
    const urgency = (Date.now() - new Date(order.createdAt)) > 600000;
    const isReady = order.orderStatus?.toLowerCase() === 'ready';
    const isPaid = order.paymentStatus === 'paid';

    const bgColor =
        order.paymentStatus === 'paid' ? 'bg-red-500/10 border-red-500/30' :
            order.orderStatus === 'pending' ? 'bg-orange-500/10 border-orange-500/30' :
                order.orderStatus === 'accepted' ? 'bg-blue-500/10 border-blue-500/30' :
                    order.orderStatus === 'preparing' ? 'bg-indigo-500/10 border-indigo-500/30' :
                        order.orderStatus === 'ready' ? 'bg-emerald-500/10 border-emerald-500/40' :
                            order.orderStatus === 'readyToServe' ? 'bg-blue-500/10 border-blue-500/30' :
                                order.orderStatus === 'payment' ? 'bg-red-500/10 border-red-500/30' :
                                    'bg-[var(--theme-bg-dark)] border-[var(--theme-border)]';

    const borderAccent =
        order.paymentStatus === 'paid' ? 'border-l-red-500' :
            order.orderStatus === 'pending' ? 'border-l-orange-500' :
                order.orderStatus === 'accepted' ? 'border-l-blue-500' :
                    order.orderStatus === 'preparing' ? 'border-l-indigo-500' :
                        order.orderStatus === 'ready' ? 'border-l-emerald-500' :
                            order.orderStatus === 'readyToServe' ? 'border-l-blue-500' :
                                order.orderStatus === 'payment' ? 'border-l-red-500' :
                                    'border-l-[var(--theme-text-muted)]';

    const visibleItems = order.items || [];

    return (
        <div className={`
            relative flex flex-col rounded-xl border border-l-4 shadow-sm transition-all duration-200
            hover:shadow-md active:scale-[0.98] cursor-pointer overflow-hidden h-full
            ${bgColor} ${borderAccent} ${isReady ? 'animate-pulse' : ''}
        `}>
            {/* ── Header ── */}
            <div className="px-2 pt-2.5 pb-2 border-b border-black/[0.04]">
                <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="text-[13px] font-black text-[var(--theme-text-main)] tracking-tight leading-none truncate pr-1">
                        {order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}
                    </h3>
                    <StatusBadge status={order.orderStatus} items={order.items || []} size="xs" />
                </div>

                <div className="flex flex-col gap-1 mt-1.5">
                    <div className="flex items-center justify-between gap-1">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white/60 border border-black/5 rounded-md text-[9px] font-black text-gray-700 shadow-sm truncate max-w-[50%]">
                            <Utensils size={8} className="text-orange-500 shrink-0" />
                            {order.orderType === 'dine-in'
                                ? `T ${order.tableId?.number || order.tableId || '?'}`
                                : `TK ${order.tokenNumber || '?'}`}
                        </span>
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold shrink-0 ${urgency ? 'text-red-600 bg-red-100 px-1 py-0.5 rounded-md' : 'text-gray-400'}`}>
                            <Clock size={8} />{elapsed}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Items ── */}
            <div className="flex-1 px-2 py-2 space-y-1 min-h-[60px] max-h-[120px] overflow-y-auto custom-scrollbar">
                {visibleItems.map((item, i) => {
                    const isCancelled = item.status?.toUpperCase() === 'CANCELLED';
                    return (
                        <div key={i} className="flex items-start gap-1.5">
                            <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[9px] font-black ${isCancelled ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-[var(--theme-text-muted)]'}`}>
                                {item.quantity}
                            </div>
                            <span className={`flex-1 text-[11px] font-bold leading-tight line-clamp-2 ${isCancelled ? 'text-red-500 line-through' : 'text-[var(--theme-text-main)]'}`}>
                                {item.name}{item.variant ? ` (${item.variant.name})` : ''}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* ── Footer ── */}
            <div className="px-2 py-2 border-t border-white/5 bg-white/[0.02] mt-auto">
                <div className="flex items-center justify-between gap-1">
                    <span className="text-[8px] font-black text-[var(--theme-text-muted)] uppercase tracking-tighter shrink-0">
                        {order.orderType === 'dine-in' ? 'DINE' : 'TAKE'}
                    </span>
                    <span className="text-[11px] font-black text-[var(--theme-text-main)] tabular-nums">
                        {formatPrice(order.finalAmount)}
                    </span>
                </div>
            </div>
        </div>
    );
});

/* ── Order Card (List box style) ─────────────────────────────────────────── */
const OrderCard = memo(({ order, formatPrice }) => {
    const isReady = order.orderStatus?.toLowerCase() === 'ready';
    const isPaid = order.paymentStatus === 'paid';
    const borderColor =
        order.paymentStatus === 'paid' ? 'border-l-red-500' :
            order.orderStatus === 'pending' ? 'border-l-orange-500' :
                order.orderStatus === 'accepted' ? 'border-l-blue-500' :
                    order.orderStatus === 'preparing' ? 'border-l-indigo-500' :
                        order.orderStatus === 'readyToServe' ? 'border-l-blue-500' :
                            order.orderStatus === 'payment' ? 'border-l-red-500' :
                                'border-l-red-500';
    const bgColor =
        order.paymentStatus === 'paid' ? 'bg-red-500/5 border-red-500/30' :
            order.orderStatus === 'pending' ? 'bg-orange-500/5 border-orange-500/30' :
                order.orderStatus === 'accepted' ? 'bg-blue-500/5 border-blue-500/30' :
                    order.orderStatus === 'preparing' ? 'bg-indigo-500/5 border-indigo-500/30' :
                        order.orderStatus === 'ready' ? 'bg-emerald-500/5 border-emerald-500/40' :
                            order.orderStatus === 'readyToServe' ? 'bg-blue-500/5 border-blue-500/30' :
                                order.orderStatus === 'payment' ? 'bg-red-500/5 border-red-500/30' :
                                    'bg-[var(--theme-bg-card)]';

    return (
        <div className={`
            ${bgColor} ${isReady ? 'animate-pulse' : ''}
            rounded-2xl border border-[var(--theme-border)] border-l-4 shadow-sm
            hover:shadow-md active:scale-[0.99] transition-all cursor-pointer p-3.5
        `}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-black text-[var(--theme-text-main)] tracking-tight">{order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-white/60 dark:bg-white/10 border border-[var(--theme-border)] text-[10px] font-black text-[var(--theme-text-main)] whitespace-nowrap shadow-sm">
                        {order.orderType === 'dine-in'
                            ? `Table ${order.tableId?.number || order.tableId || '?'}`
                            : `Token ${order.tokenNumber || '?'}`}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-black text-[var(--theme-text-main)]">{formatPrice(order.finalAmount)}</span>
                    <StatusBadge status={order.orderStatus} items={order.items || []} />
                </div>
            </div>
            <div className="flex items-center justify-between gap-3 mt-2">
                <p className="text-[11px] text-[var(--theme-text-muted)] font-medium line-clamp-1 flex-1">
                    {order.items?.map(i => `${i.quantity}× ${i.name}${i.variant ? ` (${i.variant.name})` : ''}`).join(', ') || 'No items'}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-[var(--theme-text-subtle)] font-bold shrink-0">
                    <Clock size={10} />
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </div>
    );
});

/* ── Production Token Card ───────────────────────────────────────────────── */
const STATUS_META = {
    pending: { bar: 'bg-amber-500', card: 'bg-amber-50   border-amber-200', num: 'text-amber-600', badge: 'bg-amber-100   text-amber-700   border-amber-300', glow: 'shadow-amber-200' },
    accepted: { bar: 'bg-blue-500', card: 'bg-blue-50    border-blue-200', num: 'text-blue-600', badge: 'bg-blue-100    text-blue-700    border-blue-300', glow: 'shadow-blue-200' },
    preparing: { bar: 'bg-violet-500', card: 'bg-violet-50  border-violet-200', num: 'text-violet-600', badge: 'bg-violet-100  text-violet-700  border-violet-300', glow: 'shadow-violet-200' },
    ready: { bar: 'bg-emerald-500', card: 'bg-emerald-50 border-emerald-300', num: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700 border-emerald-400', glow: 'shadow-emerald-300' },
    readytoserve: { bar: 'bg-blue-500', card: 'bg-blue-50    border-blue-200', num: 'text-blue-600', badge: 'bg-blue-100    text-blue-700    border-blue-300', glow: 'shadow-blue-200' },
    payment: { bar: 'bg-red-500', card: 'bg-red-50  border-red-200', num: 'text-red-700', badge: 'bg-red-100  text-red-800  border-red-300', glow: 'shadow-red-200' },
    completed: { bar: 'bg-gray-800', card: 'bg-gray-50    border-gray-300', num: 'text-gray-900', badge: 'bg-gray-200    text-gray-800    border-gray-400', glow: 'shadow-gray-200' },
    cancelled: { bar: 'bg-rose-500', card: 'bg-rose-50    border-rose-200', num: 'text-rose-600', badge: 'bg-rose-100    text-rose-700    border-rose-300', glow: 'shadow-rose-200' },
};

const TokenSquare = memo(({ order, onClick, isSelected }) => {
    const elapsed = useElapsed(order.createdAt);
    const isReady = order.orderStatus?.toLowerCase() === 'ready';
    const s = STATUS_META[order.orderStatus?.toLowerCase()] || STATUS_META.pending;
    const isDine = order.orderType === 'dine-in';
    const identifier = isDine
        ? (order.tableId?.number || order.tableId || '?')
        : (order.tokenNumber || '?');
    const activeItems = order.items?.filter(i => i.status?.toUpperCase() !== 'CANCELLED') || [];
    const itemCount = activeItems.length;

    // Use the DB flag as the canonical source — set by server when new items are added to a ready order,
    // cleared by server when all items are READY again.
    const isPartiallyReady = !!order.isPartiallyReady;

    return (
        <button
            onClick={onClick}
            style={{ transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease, ring 200ms ease' }}
            className={`
                w-full rounded-xl border flex flex-col overflow-hidden group
                hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:scale-[0.98]
                ${isPartiallyReady ? 'bg-amber-50 border-emerald-300 shadow-emerald-100' : `${s.card} ${s.glow}`}
                ${isReady && !isPartiallyReady ? 'shadow-md shadow-emerald-200' : 'shadow-sm'}
                ${isSelected ? 'ring-2 ring-orange-500 ring-offset-1 -translate-y-0.5 shadow-lg shadow-orange-200' : ''}
            `}
        >
            {/* Status accent bar */}
            <div className={`h-1 w-full shrink-0 ${isPartiallyReady ? 'bg-emerald-500' : s.bar} ${isReady ? 'animate-pulse' : ''}`} />

            {/* Metric Top Section (Value on Top, Label Below) */}
            <div className="flex flex-col items-center pt-2.5 pb-2">
                {/* 1. Status Row */}
                <div className="flex items-center gap-1 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isPartiallyReady ? 'bg-emerald-500' : s.bar}`} />
                    <span className={`text-[7px] font-black uppercase tracking-widest ${isPartiallyReady ? 'text-emerald-700' : s.num}`}>
                        {isPartiallyReady ? 'Partial Ready' : order.orderStatus}
                    </span>
                </div>


                {/* 2. Primary Identifier (Table/Token) - FORCED BLACK */}
                <div className="flex flex-col items-center justify-center">
                    <span className={`text-2xl font-black leading-none tracking-tighter text-black group-hover:scale-110 transition-transform duration-200`}>
                        {identifier}
                    </span>
                    <span className="text-[7px] font-black uppercase tracking-[0.2rem] text-black mt-1">
                        {isDine ? 'TABLE' : 'TOKEN'}
                    </span>
                </div>
            </div>

            {/* Middle Section: Financial & Order Info - FORCED BLACK */}
            <div className="grid grid-cols-2 border-t border-black/[0.04] bg-black/[0.01]">
                <div className="flex flex-col items-center py-1.5 border-r border-black/[0.04]">
                    <span className="text-[10px] font-black text-black tracking-tight leading-none">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(order.finalAmount)}
                    </span>
                    <span className="text-[6px] font-black text-black uppercase tracking-widest mt-0.5">AMOUNT</span>
                </div>
                <div className="flex flex-col items-center py-1.5">
                    <span className="text-[10px] font-black text-black tracking-tight leading-none">
                        {order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}
                    </span>
                    <span className="text-[6px] font-black text-black uppercase tracking-widest mt-0.5">{order.orderType === 'dine-in' ? 'DINE IN' : 'TAKEAWAY'}</span>
                </div>
            </div>

            {/* Item list */}
            {activeItems.length > 0 && (
                <div className="px-2 pb-1.5 space-y-0.5 border-t border-black/[0.04] pt-1.5">
                    {activeItems.slice(0, 1).map((item, i) => (
                        <div key={i} className="flex items-center gap-1 text-[9px] font-bold text-gray-950 leading-tight">
                            <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[7px] font-black shrink-0 ${s.badge} border`}>
                                {item.quantity}
                            </span>
                            <span className="truncate">{item.name}{item.variant ? ` · ${item.variant.name}` : ''}</span>
                        </div>
                    ))}
                    {activeItems.length > 1 && (
                        <div className="pl-[1.25rem] w-full text-left">
                            <span className={`text-[7px] font-black ${s.num} opacity-70 uppercase tracking-tight`}>
                                +{activeItems.length - 1} more
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Footer bar */}
            <div className="flex items-center justify-between px-2 py-1.5 border-t border-black/[0.04] bg-black/[0.025] shrink-0">
                <span className="flex items-center gap-1 text-[8px] font-black text-gray-400">
                    <ShoppingBag size={8} />
                    {itemCount}
                </span>
                <span className={`flex items-center gap-1 text-[8px] font-black ${(Date.now() - new Date(order.createdAt)) > 600000 ? 'text-red-500' : 'text-gray-400'}`}>
                    <Clock size={8} />
                    {elapsed}
                </span>
            </div>
        </button>
    );
});

/* ── Main Component ───────────────────────────────────────────────────────── */
const WaiterDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [, setTables] = useState([]);
    const location = useLocation();
    const activeTab = location.pathname.includes('/history') ? 'history' : 'active';
    const [statusFilter, setStatusFilter] = useState(null);
    const [filterType, setFilterType] = useState('all');
    const [showTables, setShowTables] = useState(false);
    const [showCounters, setShowCounters] = useState(false); // Default Off per user request
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [cancelModal, setCancelModal] = useState({ isOpen: false, order: null, item: null });
    const [refreshing, setRefreshing] = useState(false);
    const [isProductionMode, setIsProductionMode] = useState(false);
    const { user, socket, formatPrice, formatOrderNumber, settings } = useContext(AuthContext);

    useEffect(() => {
        const local = localStorage.getItem('isProductionMode');
        if (local === null && settings?.dashboardView === 'prod') {
            setIsProductionMode(true);
        }
    }, [settings]);

    useEffect(() => {
        localStorage.setItem('isProductionMode', isProductionMode);
    }, [isProductionMode]);
    const navigate = useNavigate();

    const handleReserveTable = useCallback(async (tableId) => {
        try {
            const res = await api.put(`/api/tables/${tableId}/reserve`, {}, { headers: { Authorization: `Bearer ${user.token}` } });
            setTables(prev => prev.map(t => t._id === tableId ? res.data : t));
        } catch (err) { alert(err.response?.data?.message || 'Failed to reserve table'); }
    }, [user]);

    const handleCancelReservation = useCallback(async (tableId) => {
        try {
            const res = await api.put(`/api/tables/${tableId}/release`, {}, { headers: { Authorization: `Bearer ${user.token}` } });
            setTables(prev => prev.map(t => t._id === tableId ? res.data : t));
        } catch (err) { alert(err.response?.data?.message || 'Failed to cancel reservation'); }
    }, [user]);

    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true);
            setFetchError(false);
            const res = await api.get('/api/orders', { params: { limit: 100 }, headers: { Authorization: `Bearer ${user.token}` } });
            setOrders(res.data.orders || []);
        } catch (err) { setFetchError(true); } finally { setLoading(false); }
    }, [user]);

    useEffect(() => {
        if (user) fetchOrders();
        if (socket) {
            const playNotificationSound = () => {
                try {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                    audio.volume = 0.5;
                    audio.loop = true;
                    audio.play().catch(e => console.log('Audio play blocked. Interact with the page to enable sounds.', e));

                    // Stop after 5 seconds
                    setTimeout(() => {
                        audio.pause();
                        audio.currentTime = 0;
                    }, 5000);
                } catch (err) {
                    console.error('Error playing sound:', err);
                }
            };

            const announceOrderReady = (order) => {
                if (order.orderStatus === 'ready' && order.orderType === 'dine-in') {
                    const tableNumber = order.tableId?.number || order.tableId || '?';
                    const text = `Ready order, Dine In table number ${tableNumber}`;
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.rate = 0.9;
                    utterance.pitch = 1;
                    window.speechSynthesis.speak(utterance);
                }
            };

            const onNew = (o) => setOrders(p => { 
                if (p.find(x => x._id === o._id)) return p; 
                if (o.orderStatus === 'ready') {
                    playNotificationSound();
                    announceOrderReady(o);
                }
                return [o, ...p]; 
            });

            const onUpdate = (o) => {
                setOrders(p => { 
                    const existing = p.find(x => x._id === o._id); 
                    // Voice announcement if order becomes READY
                    if (o.orderStatus === 'ready' && (!existing || existing.orderStatus !== 'ready')) {
                        playNotificationSound();
                        announceOrderReady(o);
                    }
                    return existing ? p.map(x => x._id === o._id ? o : x) : [o, ...p]; 
                });
                if (selectedOrder?._id === o._id) {
                    if (o.paymentStatus === 'paid' || o.orderStatus === 'cancelled') setSelectedOrder(null);
                    else setSelectedOrder(o);
                }
            };
            socket.on('new-order', onNew);
            socket.on('order-updated', onUpdate);
            socket.on('order-completed', onUpdate);
            socket.on('orderCancelled', onUpdate);
            socket.on('itemUpdated', onUpdate);
            return () => {
                socket.off('new-order', onNew);
                socket.off('order-updated', onUpdate);
                socket.off('order-completed', onUpdate);
                socket.off('orderCancelled', onUpdate);
                socket.off('itemUpdated', onUpdate);
            };
        }
        window.addEventListener('pos-refresh', fetchOrders);
        return () => window.removeEventListener('pos-refresh', fetchOrders);
    }, [user, socket, fetchOrders, selectedOrder]);

    // Auto-refresh every 10 seconds to keep the dashboard in sync
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            fetchOrders();
        }, 10000);
        return () => clearInterval(interval);
    }, [user, fetchOrders]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const openId = params.get('openOrder');
        if (openId && orders.length > 0) {
            const target = orders.find(o => o._id === openId);
            if (target) { setSelectedOrder(target); navigate('/waiter', { replace: true }); }
        }
    }, [orders, navigate]);

    const handleCancelAction = async (orderId, arg2, arg3) => {
        const isItem = arg3 !== undefined;
        const url = isItem ? `/api/orders/${orderId}/items/${arg2}/cancel` : `/api/orders/${orderId}/cancel`;
        const reason = isItem ? arg3 : arg2;
        // Errors propagate to CancelOrderModal which shows the message and keeps modal open
        await api.put(url, { reason }, { headers: { Authorization: `Bearer ${user.token}` } });
    };

    const handleUpdateStatus = async (orderId, newStatus) => {
        try {
            await api.put(`/api/orders/${orderId}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
        } catch (err) { alert(err.response?.data?.message || "Action failed"); }
    };

    const handleAddItems = async (orderId, items) => {
        try {
            await api.post(`/api/orders/${orderId}/add-items`,
                { items },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
        } catch (err) {
            console.log('[Dashboard] Add items failed, queuing:', err.message);
            await queueAction({
                type: 'add-items',
                orderId,
                items,
            });
            alert('Saved offline. Will sync when online.');
        }
    };

    const activeOrders = orders.filter(o => o.paymentStatus !== 'paid' && o.orderStatus !== 'cancelled');



    const historyOrders = orders.filter(o => o.paymentStatus === 'paid').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const counts = {
        pending: activeOrders.filter(o => o.orderStatus === 'pending').length,
        ready: activeOrders.filter(o => o.orderStatus === 'ready').length,
        history: historyOrders.length,
    };

    const filteredOrders = (activeTab === 'active' ? activeOrders : historyOrders)
        .filter(o => (settings?.takeawayEnabled !== false && settings?.takeawayEnabled !== 0) || o.orderType !== 'takeaway')
        .filter(o => (settings?.dineInEnabled !== false && settings?.dineInEnabled !== 0) || o.orderType !== 'dine-in')
        .filter(o => filterType === 'all' || o.orderType === filterType)
        .filter(o => {
            if (activeTab !== 'active') return true;
            if (!statusFilter) return true;
            return o.orderStatus === statusFilter;
        });

    const readyOrders = filteredOrders.filter(o => o.orderStatus === 'ready');
    const processOrders = filteredOrders.filter(o => o.orderStatus !== 'ready');
    const displayOrders = statusFilter
        ? (statusFilter === 'ready' ? readyOrders : processOrders)
        : filteredOrders;

    // TOKEN mode: prev / next navigation
    const tokenIdx = selectedOrder ? displayOrders.findIndex(o => o._id === selectedOrder._id) : -1;
    const goNext = useCallback(() => {
        if (tokenIdx < displayOrders.length - 1) setSelectedOrder(displayOrders[tokenIdx + 1]);
    }, [tokenIdx, displayOrders]);
    const goPrev = useCallback(() => {
        if (tokenIdx > 0) setSelectedOrder(displayOrders[tokenIdx - 1]);
    }, [tokenIdx, displayOrders]);

    return (
        <div className="flex flex-col gap-2 animate-fade-in text-left flex-1 overflow-hidden min-h-0 pb-4">
            {fetchError && (
                <div id="net-error-alert" className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-bounce-subtle">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <WifiOff size={20} className="text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-red-600">Network Connection Error</h3>
                            <p className="text-[10px] text-red-500 font-medium">Cannot reach the POS server.</p>
                        </div>
                    </div>
                    <button onClick={() => fetchOrders()} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95">Try Again</button>
                </div>
            )}

            {/* ── Desktop/Tablet: Action Bar ── */}
            {document.getElementById('topbar-portal') && createPortal(
                <div className="flex items-center justify-between w-full animate-fade-in px-1 gap-2">
                    {/* Left side: Filters (Relocated from Row 2) */}
                    <div className="hidden sm:flex items-center flex-1 max-w-full overflow-hidden">
                        <div
                            className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-[var(--theme-border)] shadow-inner overflow-x-auto no-scrollbar scroll-smooth w-fit max-w-full"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {['all', 'dine-in', 'takeaway']
                                .filter(t => t !== 'takeaway' || settings?.takeawayEnabled !== false)
                                .filter(t => t !== 'dine-in' || settings?.dineInEnabled !== false)
                                .map(t => (
                                    <button
                                        key={t}
                                        onClick={(e) => {
                                            setFilterType(t);
                                            e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                                        }}
                                        className={`flex-shrink-0 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-all duration-300 whitespace-nowrap active:scale-95 ${filterType === t
                                                ? 'bg-orange-600 text-white shadow-[0_4px_12px_rgba(234,88,12,0.3)] scale-[1.02]'
                                                : 'text-[var(--theme-text-muted)] hover:text-orange-500 hover:bg-orange-500/5'
                                            }`}
                                    >
                                        {t === 'all' ? 'All' : t === 'dine-in' ? 'Dine' : 'Take'}
                                    </button>
                                ))}
                        </div>
                    </div>

                    {/* Right side: Actions + Utilities */}
                    <div className="flex items-center gap-2 ml-auto">
                        {/* Primary Order Actions (Relocated to Right) */}
                        <div className="hidden md:flex items-center gap-2 mr-2 border-r border-[var(--theme-border)] pr-2">
                            {user?.role !== 'cashier' && settings?.dineInEnabled !== false && settings?.dineInEnabled !== 0 && (
                                <button onClick={() => navigate('/dine-in')} className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-600/20 whitespace-nowrap min-h-[40px] active:scale-95">
                                    <Utensils size={14} strokeWidth={3} /> Dine In
                                </button>
                            )}
                            {user?.role !== 'cashier' && settings?.takeawayEnabled !== false && settings?.takeawayEnabled !== 0 && (
                                <button onClick={() => navigate('/take-away')} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/20 whitespace-nowrap min-h-[40px] active:scale-95">
                                    <Package size={14} strokeWidth={3} /> Takeaway
                                </button>
                            )}
                        </div>

                        {/* Utility controls & Refresh */}
                        <div className="flex items-center gap-1.5 ml-auto">
                            <button onClick={() => setShowCounters(prev => !prev)} title={showCounters ? 'Collapse Stats' : 'Expand Stats'}
                                className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 border-2 ${showCounters
                                        ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30'
                                        : 'bg-[var(--theme-bg-dark)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-orange-500'
                                    }`}>
                                <ChevronRight size={18} strokeWidth={3} className={`transition-transform duration-300 ${showCounters ? 'rotate-90' : ''}`} />
                            </button>

                            <button onClick={() => setIsProductionMode(!isProductionMode)} title={isProductionMode ? 'Detailed Grid view' : 'Token view'}
                                className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 ${isProductionMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-[var(--theme-bg-dark)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]'}`}>
                                {isProductionMode ? <Grid2X2 size={16} strokeWidth={2.5} /> : <Grid size={16} strokeWidth={2.5} />}
                            </button>

                            {settings?.tableMapEnabled !== false && (
                                <button onClick={() => setShowTables(t => !t)} title="Tables"
                                    className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 ${showTables ? 'bg-green-500/15 border-green-500/40 text-green-500 shadow-sm shadow-green-500/20' : 'bg-green-500/5 border-green-500/20 text-green-500 hover:bg-green-500/15 hover:border-green-500/40'}`}>
                                    <Armchair size={16} strokeWidth={2.5} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>,
                document.getElementById('topbar-portal')
            )}

            {/* ── Row 2 (mobile only): Compact Filters & Actions ── */}
            {document.getElementById('topbar-portal-row2') && createPortal(
                <div className="flex flex-col w-full gap-1.5 animate-fade-in px-1 pb-1 sm:hidden">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {/* Filter Pill (Mobile) - Smaller */}
                        <div
                            className="flex items-center gap-1 p-0.5 bg-black/5 dark:bg-white/5 rounded-xl border border-[var(--theme-border)] shadow-inner overflow-x-auto no-scrollbar scroll-smooth w-fit max-w-[60%]"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {['all', 'dine', 'takeaway']
                                .filter(t => t !== 'takeaway' || settings?.takeawayEnabled !== false)
                                .filter(t => t !== 'dine' || settings?.dineInEnabled !== false)
                                .map(t => (
                                    <button
                                        key={t}
                                        onClick={(e) => {
                                            setFilterType(t);
                                            e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                                        }}
                                        className={`flex-shrink-0 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all duration-300 whitespace-nowrap active:scale-95 ${filterType === t
                                                ? 'bg-orange-600 text-white shadow-sm'
                                                : 'text-[var(--theme-text-muted)] hover:text-orange-500'
                                            }`}
                                    >
                                        {t === 'all' ? 'All' : t === 'dine' ? 'Dine' : 'Take'}
                                    </button>
                                ))}
                        </div>

                        <div className="flex items-center gap-1 ml-auto shrink-0">
                            {settings?.tableMapEnabled !== false && (
                                <button onClick={() => setShowTables(t => !t)} className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all active:scale-95 ${showTables ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500' : 'bg-[var(--theme-bg-dark)] border-[var(--theme-border)] text-[var(--theme-text-muted)]'}`}>
                                    <Armchair size={15} strokeWidth={2.5} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Compact Creation Buttons */}
                    <div className="flex items-center gap-2 py-1">
                        {user?.role !== 'cashier' && settings?.dineInEnabled !== false && settings?.dineInEnabled !== 0 && (
                            <button onClick={() => navigate('/dine-in')} className="flex-1 flex items-center justify-center gap-2 h-10 bg-orange-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider active:scale-95 shadow-md shadow-orange-600/10 transition-all">
                                <Utensils size={14} strokeWidth={3} /> Dine In
                            </button>
                        )}
                        {user?.role !== 'cashier' && settings?.takeawayEnabled !== false && settings?.takeawayEnabled !== 0 && (
                            <button onClick={() => navigate('/take-away')} className="flex-1 flex items-center justify-center gap-2 h-10 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider active:scale-95 shadow-md shadow-blue-600/10 transition-all">
                                <Package size={14} strokeWidth={3} /> Takeaway
                            </button>
                        )}
                    </div>
                </div>,
                document.getElementById('topbar-portal-row2')
            )}

            {/* ── Stats (Mobile: Modal Popup | Desktop: Inline) ── */}
            {activeTab === 'active' && (
                <div className={`hidden sm:block overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${showCounters ? 'max-h-[400px] opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'}`}>
                    <div className="bg-[var(--theme-bg-card)] border-b border-[var(--theme-border)] shadow-sm p-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { key: 'pending', count: counts.pending, color: 'orange', label: 'NEW KOT' },
                                { key: 'ready', count: counts.ready, color: 'emerald', label: 'READY' },
                                { key: 'preparing', count: activeOrders.filter(o => o.orderStatus === 'preparing').length, color: 'blue', label: 'PREPARING' },
                                { key: null, count: activeOrders.length, color: 'orange', label: 'ALL ACTIVE', isClear: true }
                            ].map(({ key, count, color, label, isClear }, idx) => {
                                const isActive = (statusFilter === key || (isClear && !statusFilter));
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setStatusFilter(isClear ? null : key)}
                                        className={`
                                            group relative flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all duration-300 border-2
                                            ${isActive
                                                ? 'bg-orange-500/10 border-orange-500 shadow-md shadow-orange-500/10 scale-[0.98]'
                                                : 'bg-[var(--theme-bg-dark)] border-[var(--theme-border)] hover:border-orange-500/30'
                                            }
                                        `}
                                    >
                                        <span className={`text-2xl font-black tabular-nums tracking-tighter transition-colors ${isActive ? 'text-orange-500' : 'text-[var(--theme-text-main)]'}`}>
                                            {count}
                                        </span>

                                        <div className="flex items-center gap-1 mt-1">
                                            <div className={`flex items-center opacity-60 ${isActive ? 'text-orange-500' : 'text-[var(--theme-text-muted)]'}`}>
                                                <ChevronRight size={10} strokeWidth={4} className="animate-chevron-r1" />
                                                <ChevronRight size={10} strokeWidth={4} className="-ml-1.5 opacity-60 font-black animate-chevron-r2" />
                                            </div>
                                            <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${isActive ? 'text-orange-500' : 'text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text-main)]'}`}>
                                                {label}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Stats Modal Popup */}
            {activeTab === 'active' && showCounters && (
                <div className="sm:hidden fixed inset-0 z-[1001] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCounters(false)} />
                    <div className="relative w-full max-w-[320px] bg-[var(--theme-bg-card)] rounded-[2rem] border border-[var(--theme-border)] shadow-2xl p-6 animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--theme-text-muted)]">Order Statistics</h3>
                            <button onClick={() => setShowCounters(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-[var(--theme-bg-dark)]/50 text-[var(--theme-text-muted)]">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { key: 'pending', count: counts.pending, color: 'orange', label: 'NEW KOT' },
                                { key: 'ready', count: counts.ready, color: 'emerald', label: 'READY' },
                                { key: 'preparing', count: activeOrders.filter(o => o.orderStatus === 'preparing').length, color: 'blue', label: 'PREPARING' },
                                { key: null, count: activeOrders.length, color: 'orange', label: 'ALL ACTIVE', isClear: true }
                            ].map(({ key, count, color, label, isClear }, idx) => {
                                const isActive = (statusFilter === key || (isClear && !statusFilter));
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setStatusFilter(isClear ? null : key);
                                            setShowCounters(false);
                                        }}
                                        className={`
                                            group relative flex flex-col items-center justify-center py-4 rounded-2xl transition-all border-2
                                            ${isActive
                                                ? 'bg-orange-500/10 border-orange-500 shadow-lg shadow-orange-500/10'
                                                : 'bg-[var(--theme-bg-dark)] border-[var(--theme-border)]'
                                            }
                                        `}
                                    >
                                        <span className={`text-xl font-black tabular-nums transition-colors ${isActive ? 'text-orange-500' : 'text-[var(--theme-text-main)]'}`}>
                                            {count}
                                        </span>
                                        <span className={`text-[8px] font-black uppercase tracking-widest mt-1 ${isActive ? 'text-orange-500' : 'text-[var(--theme-text-muted)]'}`}>
                                            {label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {showTables && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowTables(false); }}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="relative bg-[var(--theme-bg-card)] rounded-3xl border-2 border-[var(--theme-border)] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--theme-border)] shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                                    <Grid size={20} className="text-emerald-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-[var(--theme-text-main)] tracking-tight">Table Map</h2>
                                    <p className="text-[10px] text-[var(--theme-text-muted)] uppercase font-bold tracking-widest opacity-60">Floor Overview</p>
                                </div>
                            </div>
                            <button onClick={() => setShowTables(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors text-[var(--theme-text-muted)]">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 sm:p-5 flex-1">
                            <TableGrid
                                allowedStatuses={['available', 'occupied', 'cleaning']}
                                filterByAllowedStatuses={false}
                                showCleanAction={true}
                                onReserve={handleReserveTable}
                                onCancelReservation={handleCancelReservation}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Flex split: cards left + panel right ────────────────────────── */}
            <div className="flex gap-0 relative h-[calc(100vh-70px)] overflow-hidden">

                {/* ── Left panel (Order Grid) ────────────────────────────────── */}
                <div
                    className={`flex-1 kot-scroll transition-all duration-300 ${selectedOrder ? 'opacity-100' : 'opacity-100'}`}
                >
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2">
                            {Array(8).fill(0).map((_, i) => <div key={i} className="skeleton rounded-2xl h-48" />)}
                        </div>
                    ) : displayOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-[var(--theme-text-subtle)]">
                            {activeTab === 'active' ? (
                                <>
                                    <ShoppingBag size={44} className="mb-2 opacity-20" />
                                    <h3 className="text-base font-extrabold text-[var(--theme-text-muted)]">{statusFilter ? `No ${statusFilter} orders` : 'No active orders'}</h3>
                                    <p className="text-xs mt-1 opacity-70 tracking-tight">{statusFilter ? `Try clearing the filter` : `Tap "New Order" to create one`}</p>
                                </>
                            ) : (
                                <>
                                    <History size={52} className="mb-3 opacity-20" />
                                    <h3 className="text-lg font-bold text-[var(--theme-text-muted)]">No history yet</h3>
                                    <p className="text-sm mt-1">Completed & cancelled orders appear here.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className={`grid p-2 w-full mx-auto gap-3 transition-all duration-300 ${isProductionMode
                                ? selectedOrder
                                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                                    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8'
                                : selectedOrder
                                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                                    : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                            }`}>
                            {displayOrders.map(order => (
                                isProductionMode
                                    ? <TokenSquare key={order._id} order={order} onClick={() => setSelectedOrder(order)} isSelected={selectedOrder?._id === order._id} />
                                    : (
                                        <div
                                            key={order._id}
                                            onClick={() => setSelectedOrder(order)}
                                            className={`transition-all duration-200 rounded-xl ring-2 ${selectedOrder?._id === order._id ? 'ring-orange-500 shadow-lg shadow-orange-500/20' : 'ring-transparent'}`}
                                        >
                                            <WaiterBoxCard order={order} formatPrice={formatPrice} />
                                        </div>
                                    )
                            ))}
                        </div>
                    )}
                    <div className="pb-10" />
                </div>

                {/* ── Right Panel (Details Panel) ── desktop only ────────────────── */}
                {selectedOrder && (
                    <div
                        className="hidden md:flex flex-col flex-shrink-0 w-[400px] lg:w-[440px] xl:w-[480px] border-l border-[var(--theme-border)] bg-[var(--theme-bg-card)] animate-in slide-in-from-right duration-300 ease-out"
                    >
                        <OrderDetailsModal
                            variant="panel"
                            isOpen={true}
                            order={selectedOrder}
                            onClose={() => setSelectedOrder(null)}
                            formatPrice={formatPrice}
                            userRole={user.role}
                            onCancelItem={(o, i) => setCancelModal({ isOpen: true, order: o, item: i })}
                            onCancelOrder={(o) => setCancelModal({ isOpen: true, order: o, item: null })}
                            onUpdateStatus={handleUpdateStatus}
                            onAddItem={handleAddItems}
                            settings={settings}
                        />
                    </div>
                )}
            </div>

            {/* ── Mobile focused Modal (Pop-up type) ── mobile only ───────────── */}
            {selectedOrder && createPortal(
                <div className="md:hidden">
                    <OrderDetailsModal
                        variant="overlay"
                        isOpen={true}
                        order={selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        formatPrice={formatPrice}
                        userRole={user.role}
                        onCancelItem={(o, i) => setCancelModal({ isOpen: true, order: o, item: i })}
                        onCancelOrder={(o) => setCancelModal({ isOpen: true, order: o, item: null })}
                        onUpdateStatus={handleUpdateStatus}
                        onAddItem={handleAddItems}
                        settings={settings}
                    />
                </div>,
                document.body
            )}

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

export default WaiterDashboard;
