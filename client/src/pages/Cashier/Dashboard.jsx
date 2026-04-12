import { useState, useEffect, useContext, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '../../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { getCachedOrders, getPendingOrders } from '../../db/db';
const logoImg = '/logo.png';
import PaymentModal from '../../components/PaymentModal';
import CancelOrderModal from '../../components/CancelOrderModal';
import StatusBadge from '../../components/StatusBadge';
import { tokenColors } from '../../utils/tokenColors';
import { printBill } from '../../components/BillPrint';
import {
    Printer, Banknote, CheckCircle,
    ShoppingBag, RefreshCw, ArrowLeft,
    Clock, AlertTriangle, Grid, List, LogOut
} from 'lucide-react';

/* ── Order List Item ──────────────────────────────────────────────────────── */
const OrderItem = memo(({ order, selected, onClick, formatPrice, viewType = 'normal', hideAmount = false }) => {
    const isGrid = viewType === 'compact';
    const isList = viewType === 'list';
    
    const isPartiallyReady = !!order.isPartiallyReady;
    const currentStatus = order.orderStatus?.toLowerCase();
    
    // Determine status metadata for vibrant grid tokens
    const statusMeta = (currentStatus === 'ready' && isPartiallyReady) 
        ? { bg: 'bg-emerald-50 border-emerald-300', text: 'text-amber-600', dot: 'bg-amber-500', label: 'bg-amber-100 text-amber-800' }
        : {
            pending:   { bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-600',   dot: 'bg-amber-500',  label: 'bg-amber-100 text-amber-700' },
            accepted:  { bg: 'bg-blue-50 border-blue-200',    text: 'text-blue-600',   dot: 'bg-blue-500',   label: 'bg-blue-100 text-blue-700' },
            preparing: { bg: 'bg-indigo-50 border-indigo-200',text: 'text-indigo-600', dot: 'bg-indigo-500', label: 'bg-indigo-100 text-indigo-700' },
            ready:     { bg: 'bg-emerald-50 border-emerald-300',text: 'text-emerald-700',dot: 'bg-emerald-500',label: 'bg-emerald-100 text-emerald-800' },
            readytoserve: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-600', dot: 'bg-blue-500', label: 'bg-blue-100 text-blue-700' },
            payment:   { bg: 'bg-rose-50 border-rose-300 shadow-rose-200', text: 'text-rose-700', dot: 'bg-rose-600', label: 'bg-rose-100 text-rose-800' },
            completed: { bg: 'bg-red-50 border-red-300',   text: 'text-red-700',   dot: 'bg-red-500',   label: 'bg-red-100 text-red-800' }
        }[currentStatus] || { bg: 'bg-gray-50 border-gray-100', text: 'text-gray-400', dot: 'bg-gray-300', label: 'bg-gray-100 text-gray-500' };

    if (isGrid) {
        const identifier = order.orderType === 'dine-in'
            ? (order.tableId?.number || order.tableId || '?')
            : order.tokenNumber;
        const isPulse = ['pending', 'ready'].includes(order.orderStatus?.toLowerCase());
        const shortStatus = ({ pending:'PEND', accepted:'ACC', preparing:'PREP', ready:'READY', readyToServe:'SERV', payment:'PAY', completed:'DONE', cancelled:'CNCL' })[order.orderStatus?.toLowerCase()] || order.orderStatus?.slice(0,4).toUpperCase();

        return (
            <button
                onClick={onClick}
                className={`
                    w-full p-2 rounded-xl border-2 flex flex-col justify-between min-h-[95px] sm:min-h-[90px] transition-all duration-300 group overflow-hidden
                    ${statusMeta.bg} ${selected ? 'ring-4 ring-orange-500 scale-[1.03] shadow-2xl z-10' : 'hover:-translate-y-0.5 shadow-md hover:shadow-xl'}
                `}
            >
                {/* Top: status + type */}
                <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusMeta.dot} ${isPulse ? 'animate-pulse' : ''}`} />
                        <span className={`text-[7px] font-black uppercase ${statusMeta.text}`}>{shortStatus}</span>
                    </div>
                    <span className={`text-[7px] font-black uppercase ${statusMeta.text}`}>
                        {order.orderType === 'dine-in' ? 'TABLE' : 'TOKEN'}
                    </span>
                </div>

                {/* Center: big number */}
                <div className="flex items-center justify-center py-2">
                    <p className={`text-3xl font-black tracking-tighter leading-none ${statusMeta.text} group-hover:scale-105 transition-transform duration-200`}>
                        {identifier}
                    </p>
                </div>

                {/* Bottom: price — hidden in history mode */}
                {!hideAmount && (
                    <div className="w-full border-t border-black/[0.08] pt-1 flex items-center justify-center">
                        <p className={`text-[9px] font-black ${statusMeta.text} whitespace-nowrap`}>
                            {formatPrice(order.finalAmount)}
                        </p>
                    </div>
                )}
            </button>
        );
    }

    const tColor = tokenColors[order.orderStatus] || 'bg-[var(--theme-bg-card)] border-[var(--theme-border)] text-[var(--theme-text-main)]';
    const isPaid = order.paymentStatus === 'paid';
    return (
        <button
            onClick={onClick}
            className={`
                w-full text-left transition-all duration-200 group token-tap rounded-2xl
                ${tColor}
                ${order.paymentStatus === 'paid' ? 'border-l-red-500 bg-red-500/10' :
                  isList ? 'p-3 border-l-[6px]' : 'p-3.5 border-l-[8px]'}
                ${order.paymentStatus !== 'paid' && (order.orderStatus === 'pending' ? 'border-l-[var(--status-pending)]' :
                  order.orderStatus === 'ready' ? 'border-l-[var(--status-ready)]' :
                  order.orderStatus === 'readyToServe' ? 'border-l-[var(--status-readyToServe)]' :
                  order.orderStatus === 'payment' ? 'border-l-[var(--status-payment)]' :
                  'border-l-transparent')}
                ${selected ? 'ring-2 ring-orange-500 shadow-xl scale-[1.01]' : 'hover:scale-[1.005] shadow-md'}
            `}
        >
            {isList ? (
                /* ── List row ── */
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="inline-flex items-center justify-center min-w-[32px] h-6 font-black text-inherit text-[9px] px-1.5 bg-black/10 rounded-lg border border-current/20 shrink-0 whitespace-nowrap">
                            {order.orderType === 'dine-in' ? `T${order.tableId?.number || order.tableId || '?'}` : `TK${order.tokenNumber}`}
                        </span>
                        <p className="text-[10px] font-black text-inherit truncate leading-none">{order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <p className="text-[11px] font-black text-inherit whitespace-nowrap">{formatPrice(order.finalAmount)}</p>
                        <StatusBadge status={order.orderStatus} size="sm" />
                    </div>
                </div>
            ) : (
                /* ── Normal card ── */
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-inherit tracking-tight truncate pr-2">{order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}</h3>
                        <StatusBadge status={order.orderStatus} />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="inline-flex items-center justify-center h-7 font-black text-inherit text-[11px] px-2.5 bg-black/10 rounded-lg border border-current/20">
                            {order.orderType === 'dine-in' ? `T${order.tableId?.number || order.tableId || '?'}` : `TK${order.tokenNumber}`}
                        </span>
                        <p className="font-black text-inherit text-base">{formatPrice(order.finalAmount)}</p>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <div className="flex items-center gap-1 text-[9px] text-inherit opacity-50 font-bold uppercase">
                            <Clock size={10} />
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {order.paymentStatus === 'payment_pending' && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/20 font-black uppercase">PAYING</span>
                        )}
                    </div>
                </div>
            )}
        </button>
    );
});

/* ── Receipt ──────────────────────────────────────────────────────────────── */
const Receipt = ({ order, formatPrice, settings }) => (
    <div id="printable-receipt" className="w-full max-w-sm mx-auto bg-white text-black px-6 py-6 relative shadow-2xl">
        {/* Watermark removed */}

        {/* Header */}
        <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4 relative z-10">
            <h1 className="text-2xl font-extrabold tracking-tight">{settings?.restaurantName || 'admin'}</h1>
            <p className="text-xs font-black text-black uppercase tracking-widest mt-0.5">Tax Invoice</p>
            <p className="text-[10px] text-gray-400 mt-1">{settings?.address || 'Restaurant Address'}</p>
            {settings?.gstNumber && <p className="text-[10px] text-gray-400">GSTIN: {settings.gstNumber}</p>}
        </div>

        {/* Meta */}
        <div className="flex justify-between text-[11px] mb-4 relative z-10">
            <div>
                <p><strong>Date:</strong> {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                <p><strong>Time:</strong> {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString()}</p>
            </div>
            <div className="text-right">
                <p><strong>Invoice:</strong> #INV-{order.orderNumber?.split('-')[1]}</p>
                <p><strong>Order:</strong> {order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}</p>
            </div>
        </div>

        {/* Items table */}
        <table className="w-full text-[11px] mb-4 relative z-10">
            <thead>
                <tr className="border-b border-gray-900">
                    <th className="py-1.5 text-left font-bold">Item</th>
                    <th className="py-1.5 text-center font-bold w-8">Qty</th>
                    <th className="py-1.5 text-right font-bold">Price</th>
                </tr>
            </thead>
            <tbody>
                {order.items?.filter(item => item.status?.toUpperCase() !== 'CANCELLED').map((item, i) => (
                    <tr key={i} className="border-b border-dashed border-gray-200">
                        <td className="py-2">
                            {item.name}
                            {item.variant?.name && <span className="text-xs opacity-70"> ({item.variant.name})</span>}
                        </td>
                        <td className="py-2 text-center">{item.quantity}</td>
                        <td className="py-2 text-right">{formatPrice(item.price * item.quantity)}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* Totals */}
        <div className="border-t-2 border-gray-900 pt-2 space-y-1 text-right relative z-10 mb-5">
            <div className="flex justify-between text-[11px]">
                <span className="font-bold uppercase tracking-widest text-[9px] opacity-60">Subtotal:</span>
                <span className="font-bold">{formatPrice(order.totalAmount)}</span>
            </div>
            
            {(order.sgst > 0 || settings?.sgst > 0) && (
                <div className="flex justify-between text-[11px]">
                    <span className="font-bold uppercase tracking-widest text-[9px] opacity-60">SGST ({settings?.sgst || 0}%):</span>
                    <span className="font-bold">{formatPrice(order.sgst || (order.totalAmount * (settings?.sgst || 0) / 100))}</span>
                </div>
            )}
            
            {(order.cgst > 0 || settings?.cgst > 0) && (
                <div className="flex justify-between text-[11px]">
                    <span className="font-bold uppercase tracking-widest text-[9px] opacity-60">CGST ({settings?.cgst || 0}%):</span>
                    <span className="font-bold">{formatPrice(order.cgst || (order.totalAmount * (settings?.cgst || 0) / 100))}</span>
                </div>
            )}

            {order.discount > 0 && (
                <div className="flex justify-between text-[11px] text-red-500">
                    <span className="font-bold uppercase tracking-widest text-[9px] opacity-60">Discount:</span>
                    <span className="font-bold">-{formatPrice(order.discount)}</span>
                </div>
            )}

            <div className="flex justify-between items-center text-lg font-black border-t-2 border-gray-900 pt-2 mt-2">
                <span className="uppercase tracking-tighter">Total:</span>
                <span className="text-xl tracking-tight">{formatPrice(order.finalAmount)}</span>
            </div>
        </div>

        {/* Payment method (shown after payment) */}
        {order.paymentMethod && (
            <div className="text-center text-[10px] text-gray-500 border-t border-dashed border-gray-300 pt-2 pb-2 relative z-10 mb-2">
                <p className="uppercase font-bold">
                    Paid via {order.paymentMethod === 'credit_card' ? 'Credit Card' : order.paymentMethod.toUpperCase()}
                </p>
            </div>
        )}

        {/* Footer */}
        <div className="text-center text-[9px] text-gray-400 border-t border-gray-200 pt-3 relative z-10">
            <p className="font-bold uppercase mb-1">Thank you for choosing KAGZSO</p>
            <p>Powered by Kagzso Management System</p>
        </div>
    </div>
);

/* ── Main POS Component ──────────────────────────────────────────────────── */
const CashierDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showInvoice, setShowInvoice] = useState(false); // mobile panel toggle
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [showPrintConfirm, setShowPrintConfirm] = useState(false);
    const [filterType, setFilterType] = useState('all'); // 'all' | 'dine-in' | 'takeaway'
    const [cancelModal, setCancelModal] = useState({ isOpen: false, order: null });
    const [isCardView, setIsCardView] = useState(() => localStorage.getItem('cashierCardView') !== 'false');
    const [lgCols, setLgCols] = useState(() => {
        const stored = parseInt(localStorage.getItem('cashierLgCols'));
        if (stored === 3 || stored === 4) return stored;
        const sidebar = document.querySelector('aside');
        return (sidebar && sidebar.offsetWidth > 120) ? 3 : 4;
    });
    const { user, socket, formatPrice, formatOrderNumber, settings } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const isHistoryMode = location.pathname.includes('/history');

    // Auto-adjust desktop columns when sidebar expands/collapses
    useEffect(() => {
        const handler = (e) => {
            const collapsed = e.detail?.collapsed;
            const next = collapsed ? 4 : 3;
            setLgCols(next);
            localStorage.setItem('cashierLgCols', next);
        };
        window.addEventListener('sidebar-toggle', handler);
        return () => window.removeEventListener('sidebar-toggle', handler);
    }, []);

    /* ── Fetch Orders ────────────────────────────────────────────────── */
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        if (!navigator.onLine) {
            const [cached, pending] = await Promise.all([getCachedOrders(), getPendingOrders()]);
            const allOrders = [...(pending || []), ...(cached || [])];
            if (isHistoryMode) {
                setOrders(allOrders.filter(o => o.orderStatus === 'completed' || o.orderStatus === 'cancelled'));
            } else {
                setOrders(allOrders.filter(o => o.orderStatus === 'payment'));
            }
            setLoading(false);
            return;
        }
        try {
            const res = await api.get('/api/orders', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            const allOrders = res.data.orders || [];
            if (isHistoryMode) {
                setOrders(allOrders.filter(o => o.orderStatus === 'completed' || o.orderStatus === 'cancelled'));
            } else {
                setOrders(allOrders.filter(o => o.orderStatus === 'payment'));
            }
        } catch (err) {
            console.error('Error fetching orders', err);
            const cached = await getCachedOrders();
            const allOrders = cached || [];
            if (isHistoryMode) {
                setOrders(allOrders.filter(o => o.orderStatus === 'completed' || o.orderStatus === 'cancelled'));
            } else {
                setOrders(allOrders.filter(o => o.orderStatus === 'payment'));
            }
        } finally {
            setLoading(false);
        }
    }, [user, isHistoryMode]);
    const filteredOrders = useMemo(() => {
        if (!Array.isArray(orders)) return [];
        return orders.filter(o => filterType === 'all' || o.orderType === filterType);
    }, [orders, filterType]);

    // ── Pre-calculate counts for filters ───
    const counts = useMemo(() => {
        if (!Array.isArray(orders)) return { all: 0, 'dine-in': 0, takeaway: 0 };
        return {
            all: orders.length,
            'dine-in': orders.filter(o => o.orderType === 'dine-in').length,
            takeaway: orders.filter(o => o.orderType === 'takeaway').length
        };
    }, [orders]);

    // ── Sync selected order when list updates ────────────
    useEffect(() => {
        if (selectedOrder) {
            const updated = orders.find(o => o._id === selectedOrder._id);
            // Quick reference check or simple prop check instead of expensive stringify
            if (updated && (updated.orderStatus !== selectedOrder.orderStatus || updated.paymentStatus !== selectedOrder.paymentStatus || updated.items?.length !== selectedOrder.items?.length)) {
                setSelectedOrder(updated);
            }
        }
    }, [orders, selectedOrder]);

    useEffect(() => {
        if (!user) return;
        fetchOrders();

        if (socket) {
            // Real-time updates: no polling needed
            const onNewOrder = (order) => {
                const alreadyExists = prev => prev.find(o => o._id === order._id);
                if (isHistoryMode) {
                    if ((order.paymentStatus === 'paid' || order.orderStatus === 'cancelled')) {
                         setOrders(prev => alreadyExists(prev) ? prev : [order, ...prev]);
                    }
                } else if (order.orderStatus === 'payment') {
                    setOrders(prev => alreadyExists(prev) ? prev : [order, ...prev]);
                }
            };

            const onOrderUpdate = (order) => {
                setOrders(prev => {
                    const exists = prev.find(o => o._id === order._id);
                    if (isHistoryMode) {
                        // In history, if it's now paid/cancelled, ensure it's in list.
                        if (order.paymentStatus === 'paid' || order.orderStatus === 'cancelled') {
                            return exists ? prev.map(o => o._id === order._id ? order : o) : [order, ...prev];
                        } else {
                            return prev.filter(o => o._id !== order._id);
                        }
                    } else {
                        // In POS, only show orders that are in 'payment' stage.
                        // If it's paid, cancelled, or still in another kitchen status, remove it from list.
                        if (order.orderStatus !== 'payment') {
                            return prev.filter(o => o._id !== order._id);
                        }
                        // Update existing order (or add if it just reached payment status)
                        if (exists) return prev.map(o => o._id === order._id ? order : o);
                        return [order, ...prev];
                    }
                });
                // Keep selected order in sync or deselect if closed
                setSelectedOrder(sel => {
                    if (sel?._id !== order._id) return sel;
                    if (!isHistoryMode && (order.paymentStatus === 'paid' || order.orderStatus === 'cancelled')) return null;
                    return order;
                });
            };

            socket.on('new-order', onNewOrder);
            socket.on('order-updated', onOrderUpdate);
            socket.on('order-completed', onOrderUpdate);
            socket.on('orderCancelled', onOrderUpdate);

            return () => {
                socket.off('new-order', onNewOrder);
                socket.off('order-updated', onOrderUpdate);
                socket.off('order-completed', onOrderUpdate);
                socket.off('orderCancelled', onOrderUpdate);
            };
        }
        window.addEventListener('pos-refresh', fetchOrders);
        return () => window.removeEventListener('pos-refresh', fetchOrders);
    }, [user, socket, fetchOrders]);

    /* ── Select Order ────────────────────────────────────────────────── */
    const handleSelect = (order) => {
        setSelectedOrder(order);
        setPaymentSuccess(false);
        setShowInvoice(true); // on mobile, switch to invoice panel
    };

    /* ── Open Payment Modal ────────────────────────────────────────── */
    const handleOpenPayment = () => {
        if (!selectedOrder || selectedOrder.paymentStatus === 'paid') return;
        // Block payment unless kitchen has marked ALL items ready
        if (!['ready', 'readyToServe', 'payment'].includes(selectedOrder.orderStatus)) return;
        // Block payment if new items were added and aren't fully ready yet
        if (selectedOrder.isPartiallyReady) return;
        setShowPaymentModal(true);
    };

    const handleCancelOrder = async (orderId, reason) => {
        try {
            await api.put(`/api/orders/${orderId}/cancel`, { reason }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setCancelModal({ isOpen: false, order: null });
        } catch (err) {
            console.error('Cancel Order failed', err);
        }
    };

    /* ── Payment Success Handler ──────────────────────────────────── */
    const handlePaymentSuccess = () => {
        setShowPaymentModal(false);
        setPaymentSuccess(true);
        setOrders(prev => prev.filter(o => o._id !== selectedOrder._id));

        // Show success state briefly, then reset
        setTimeout(() => {
            setSelectedOrder(null);
            setPaymentSuccess(false);
            setShowInvoice(false);
        }, 2000);
    };

    /* ── Close Payment Modal ──────────────────────────────────────── */
    const handleClosePayment = () => {
        setShowPaymentModal(false);
    };

    // Fully ready = All items in KOT are READY and order marked as ready or later stage
    const isKitchenReady = ['ready', 'readyToServe', 'payment'].includes(selectedOrder?.orderStatus) && 
                           !selectedOrder?.isPartiallyReady && 
                           (selectedOrder?.items || []).every(i => ['READY', 'CANCELLED'].includes(i.status?.toUpperCase()));
    const isPayDisabled = !selectedOrder || paymentSuccess || selectedOrder?.orderStatus === 'completed' || !isKitchenReady;

    /* ── Layout ─────────────────────────────────────────────────────── */
    return (
        <div className="animate-fade-in flex-1 flex flex-col min-h-0 overflow-hidden">

            {/* ── POS Layout ────────────────────────────────────── */}
            <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">

            {/* ── Row 1: Utility buttons pushed right ── */}
            {document.getElementById('topbar-portal') && createPortal(
                <div className="flex items-center w-full gap-1.5 animate-fade-in px-1">
                    {/* Left: Filters - Desktop only */}
                    <div className="hidden md:flex items-center gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-full border border-[var(--theme-border)] shadow-inner">
                          {['all', 'dine-in', 'takeaway']
                            .filter(t => settings?.takeawayEnabled !== false || t !== 'takeaway')
                            .filter(t => settings?.dineInEnabled !== false || t !== 'dine-in')
                            .map(t => (
                                <button
                                    key={t}
                                    onClick={() => setFilterType(t)}
                                    className={`flex items-center gap-1.5 flex-shrink-0 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                                        filterType === t 
                                            ? 'bg-orange-600 text-white shadow-md' 
                                            : 'text-[var(--theme-text-muted)] hover:text-orange-500 hover:bg-orange-500/5'
                                    }`}
                                >
                                    {t === 'all' ? 'All' : t === 'dine-in' ? 'Dine' : 'Take'}
                                    {counts[t] > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${filterType === t ? 'bg-white/20 text-white' : 'bg-orange-500/10 text-orange-500'}`}>
                                            {counts[t]}
                                        </span>
                                    )}
                                </button>
                            ))}
                    </div>

                    {/* Right Utilities (relocated to right using ml-auto) */}
                    <div className="flex items-center gap-1 xs:gap-1.5 shrink-0 ml-auto">
                        {/* Pending count badge */}
                        <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 px-2 xs:px-2.5 h-8 xs:h-9 flex items-center justify-center rounded-lg xs:rounded-xl text-[9px] xs:text-[10px] font-black transition-all">
                            {(orders || []).filter(o => filterType === 'all' || o.orderType === filterType).length}
                        </div>

                         <button
                            onClick={() => { const next = !isCardView; setIsCardView(next); localStorage.setItem('cashierCardView', next); }}
                            className={`w-8 h-8 xs:w-9 xs:h-9 flex items-center justify-center rounded-lg xs:rounded-xl border transition-all active:scale-75 ${isCardView ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500 shadow-inner' : 'bg-orange-500/15 border-orange-500/30 text-orange-500 shadow-inner'}`}
                        >
                            {isCardView ? <Grid size={14} xs:size={16} strokeWidth={2.5} /> : <List size={14} xs:size={16} strokeWidth={2.5} />}
                        </button>


                    </div>
                </div>,
                document.getElementById('topbar-portal')
            )}

            {/* ── Row 2 (mobile only): Filters Moved Down (Aligned Grid) ── */}
            <div className="flex md:hidden items-center w-full px-2 mb-2 animate-fade-in shrink-0">
                <div className="grid grid-cols-3 w-full gap-1 p-1 bg-[var(--theme-bg-hover)] rounded-2xl border border-[var(--theme-border)] shadow-sm">
                    {['all', 'dine-in', 'takeaway']
                        .filter(t => settings?.takeawayEnabled !== false || t !== 'takeaway')
                        .filter(t => settings?.dineInEnabled !== false || t !== 'dine-in')
                        .map(t => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t)}
                                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                                    filterType === t 
                                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20' 
                                        : 'text-[var(--theme-text-muted)]'
                                }`}
                            >
                                <span className="truncate">{t === 'all' ? 'All' : t === 'dine-in' ? 'Dine' : 'Take'}</span>
                                {counts[t] > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-lg text-[9px] ${filterType === t ? 'bg-white/20 text-white' : 'bg-orange-500/10 text-orange-500'}`}>
                                        {counts[t]}
                                    </span>
                                )}
                            </button>
                        ))}
                </div>
            </div>


                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-3 flex-1 min-h-0">

                    {/* ── Left: Order List ──────────────── */}
                    <div className={`
                        md:col-span-2 bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)]
                        overflow-hidden flex flex-col min-h-0
                        ${showInvoice ? 'hidden md:flex' : 'flex'}
                    `}>
                        
                        <div className={`
                            flex-1 kot-scroll p-3 sm:p-4 pb-40 animate-fade-in custom-scrollbar content-visibility-auto
                            ${isCardView 
                                ? `grid gap-2 content-start ${selectedOrder 
                                    ? 'grid-cols-1 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2' 
                                    : `grid-cols-2 sm:grid-cols-3 md:grid-cols-2 ${lgCols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}` 
                                : 'space-y-2.5'}
                        `}>
                            {loading ? (
                                Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)
                            ) : filteredOrders.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-[var(--theme-text-subtle)]">
                                    <ShoppingBag size={40} className="mb-2 opacity-30" />
                                    <p className="text-sm font-medium">No orders</p>
                                </div>
                            ) : (
                                filteredOrders.map(order => (
                                    <OrderItem
                                        key={order._id}
                                        order={order}
                                        selected={selectedOrder?._id === order._id}
                                        onClick={() => handleSelect(order)}
                                        formatPrice={formatPrice}
                                        viewType={isCardView ? 'compact' : 'list'}
                                        hideAmount={isHistoryMode}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* ── Right: Invoice Panel ──────────── */}
                    <div className={`
                        md:col-span-3 bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)]
                        flex flex-col overflow-hidden relative min-h-0
                        ${showInvoice ? 'flex' : 'hidden md:flex'}
                    `}>
                        {/* Mobile back */}
                        {showInvoice && (
                            <button
                                onClick={() => { setShowInvoice(false); }}
                                className="md:hidden flex items-center gap-2 p-3 text-sm text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] border-b border-[var(--theme-border)] flex-shrink-0"
                            >
                                <ArrowLeft size={16} /> Back to order list
                            </button>
                        )}
                        {selectedOrder ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                {/* Actions Bar (Relocated to Top for focus) */}
                                <div className="flex-shrink-0 p-4 md:p-5 bg-[var(--theme-bg-card)] border-b border-[var(--theme-border)] z-10 shadow-sm">
                                    {/* Kitchen waiting banner */}
                                    {!isKitchenReady && !paymentSuccess && selectedOrder.paymentStatus !== 'paid' && (
                                        <div 
                                            className="mb-4 flex items-center gap-3 p-3.5 rounded-xl border animate-fade-in transition-colors"
                                            style={{ 
                                                backgroundColor: `var(--status-${selectedOrder.orderStatus?.toLowerCase()}-bg)`,
                                                borderColor: `var(--status-${selectedOrder.orderStatus?.toLowerCase()}-border)`
                                            }}
                                        >
                                            <div className="w-9 h-9 rounded-lg bg-black/5 flex items-center justify-center flex-shrink-0">
                                                <Clock size={18} className="animate-pulse" style={{ color: `var(--status-${selectedOrder.orderStatus?.toLowerCase()})` }} />
                                            </div>
                                            <div>
                                                <p className="text-[12px] xs:text-sm font-bold" style={{ color: `var(--status-${selectedOrder.orderStatus?.toLowerCase()})` }}>
                                                    {selectedOrder.isPartiallyReady
                                                        ? 'New item still being prepared by kitchen.'
                                                        : 'Waiting for kitchen to complete order.'}
                                                </p>
                                                <p className="text-[9px] xs:text-[10px] mt-0.5 uppercase font-semibold tracking-wider opacity-60" style={{ color: `var(--status-${selectedOrder.orderStatus?.toLowerCase()})` }}>
                                                    {selectedOrder.isPartiallyReady
                                                        ? 'Partially Ready • Payment locked'
                                                        : `Status: ${selectedOrder.orderStatus?.toUpperCase() || 'UNKNOWN'} • Locked`}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div>
                                            <p className="text-xs text-[var(--theme-text-subtle)] font-medium">Amount Due</p>
                                            <p className="text-2xl md:text-3xl font-black text-[var(--theme-text-main)]">
                                                {formatPrice(selectedOrder.finalAmount)}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">

                                            <button
                                                onClick={() => setShowPrintConfirm(true)}
                                                className="flex items-center gap-2 px-4 md:px-5 py-3 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-main)] rounded-xl font-semibold text-sm transition-colors min-h-[44px] border border-[var(--theme-border)]"
                                            >
                                                <Printer size={17} />
                                                Print
                                            </button>
                                            <button
                                                onClick={handleOpenPayment}
                                                disabled={isPayDisabled}
                                                className={`
                                                    flex items-center gap-2 px-5 md:px-7 py-3 rounded-xl font-black text-sm
                                                    shadow-lg transition-all duration-200 min-h-[44px]
                                                    ${isPayDisabled
                                                        ? 'bg-[var(--theme-bg-hover)] text-[var(--theme-text-subtle)] cursor-not-allowed'
                                                        : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-glow-green active:scale-95'
                                                    }
                                                `}
                                            >
                                                {paymentSuccess ? (
                                                    <><CheckCircle size={17} /> Paid ✓</>
                                                ) : !isKitchenReady ? (
                                                    <><AlertTriangle size={17} /> Awaiting Kitchen</>
                                                ) : (
                                                    <><Banknote size={17} /> Pay Now</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Receipt Scroll Area */}
                                <div className="flex-1 overflow-y-auto bg-[var(--theme-bg-deep)] pb-40 animate-fade-in relative custom-scrollbar p-4 md:p-8">
                                    {/* Payment Success Overlay */}
                                    {paymentSuccess && (
                                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[var(--theme-bg-dark)]/95 backdrop-blur-sm animate-scale-in">
                                            <div className="bg-emerald-500 rounded-full p-5 mb-4 shadow-glow-green animate-bounce">
                                                <CheckCircle size={44} className="text-white" />
                                            </div>
                                            <h3 className="text-2xl font-black text-[var(--theme-text-main)] mb-1">Payment Successful!</h3>
                                            <p className="text-emerald-400 text-sm font-medium">Token closed • Order completed</p>
                                        </div>
                                    )}
                                    <div className="p-2 sm:p-4 md:p-6 flex justify-center">
                                        <Receipt order={selectedOrder} formatPrice={formatPrice} settings={settings} />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Empty state */
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                <div className="w-20 h-20 bg-[var(--theme-bg-deep)] rounded-full flex items-center justify-center border-2 border-[var(--theme-border)] mb-5 shadow-xl overflow-hidden p-3">
                                    <img src={logoImg} alt="KAGSZO" className="w-full h-full object-contain" />
                                </div>
                                <h3 className="text-xl font-bold text-[var(--theme-text-main)] mb-2">No Order Selected</h3>
                                <p className="text-[var(--theme-text-subtle)] text-sm max-w-xs">
                                    Select a pending order from the list to view the invoice and process payment.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── TOP POPUP: Print Confirmation (iOS Style) ── */}
                {showPrintConfirm && selectedOrder && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-scale-in">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[4px]" onClick={() => setShowPrintConfirm(false)} />
                        <div className="relative bg-white rounded-[1.3rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col w-full max-w-[260px]">
                            {/* Content Block */}
                            <div className="p-5 flex flex-col items-center text-center gap-1.5 text-black">
                                <h4 className="text-[17px] font-semibold tracking-tight leading-tight">Print Bill?</h4>
                                <p className="text-[13px] text-gray-600 leading-tight">
                                    Generate invoice for {selectedOrder.orderNumber}?
                                </p>
                            </div>
                            
                            {/* Buttons Block (iOS Style) */}
                            <div className="grid grid-cols-2 border-t border-gray-200">
                                <button 
                                    onClick={() => setShowPrintConfirm(false)}
                                    className="h-11 flex items-center justify-center text-[17px] text-[#007AFF] font-normal hover:bg-gray-50 active:bg-gray-100 transition-colors border-r border-gray-200"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => { printBill(selectedOrder, formatPrice, settings); setShowPrintConfirm(false); }}
                                    className="h-11 flex items-center justify-center text-[17px] text-[#FF3B30] font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                >
                                    Print
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Payment Modal ────────────────────────────────── */}
            {showPaymentModal && selectedOrder && (
                <PaymentModal
                    order={selectedOrder}
                    formatPrice={formatPrice}
                    onClose={handleClosePayment}
                    onSuccess={handlePaymentSuccess}
                    api={api}
                    settings={settings}
                />
            )}

            <CancelOrderModal
                isOpen={cancelModal.isOpen}
                order={cancelModal.order}
                item={null}
                title="Cancel Order"
                onClose={() => setCancelModal({ isOpen: false, order: null })}
                onConfirm={handleCancelOrder}
            />
        </div>
    );
};

export default CashierDashboard;
