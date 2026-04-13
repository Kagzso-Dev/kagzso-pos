import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import { getCachedOrders, getPendingOrders } from '../../db/db';
import { Search, Eye, ShoppingBag, Calendar, X, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import OrderDetailsModal from '../../components/OrderDetailsModal';
import CancelOrderModal from '../../components/CancelOrderModal';
import StatusBadge from '../../components/StatusBadge';
import { tokenColors } from '../../utils/tokenColors';

/* ── Redesigned Calendar Range Picker ────────────────────────────────────────── */
const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const toYMD = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const MonthGrid = ({ year, month, today, fromDate, toDate, hoverDate, onDayClick, setHoverDate }) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const dayStr = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    // Range highlight logic
    const effectiveTo = hoverDate && fromDate && !toDate
        ? (hoverDate >= fromDate ? hoverDate : fromDate)
        : toDate;
    const effectiveFrom = hoverDate && fromDate && !toDate && hoverDate < fromDate
        ? hoverDate : fromDate;

    return (
        <div className="flex-1 w-full max-w-[320px] mx-auto">
            <div className="flex flex-col items-center mb-6">
                <span className="text-base font-black text-[var(--theme-text-main)] tracking-tight">{MONTHS[month]}</span>
                <span className="text-[7px] font-black text-orange-500 uppercase tracking-[0.3em] opacity-40">{year}</span>
            </div>
            
            <div className="grid grid-cols-7 gap-px mb-1">
                {DAYS_SHORT.map((d, i) => (
                    <div key={i} className="text-center text-[9px] font-black text-[var(--theme-text-muted)] opacity-30 py-1">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1 gap-px">
                {cells.map((d, i) => {
                    if (!d) return <div key={`e-${i}`} className="h-8 sm:h-9" />;
                    const ds = dayStr(d);
                    const isToday = ds === today;
                    const future = ds > today;
                    const from = ds === fromDate;
                    const to = ds === toDate;
                    const activeRange = effectiveFrom && effectiveTo && ds >= effectiveFrom && ds <= effectiveTo;
                    const isStart = ds === effectiveFrom;
                    const isEnd = ds === effectiveTo;

                    return (
                        <div key={ds} 
                            className={`relative flex items-center justify-center h-8 sm:h-9 transition-all duration-200
                                ${activeRange ? 'bg-orange-500/5' : ''}
                                ${isStart && effectiveTo && ds !== effectiveTo ? 'rounded-l-2xl bg-orange-500/10' : ''}
                                ${isEnd && effectiveFrom && ds !== effectiveFrom ? 'rounded-r-2xl bg-orange-500/10' : ''}
                            `}>
                            <button
                                onClick={() => !future && onDayClick(ds)}
                                onMouseEnter={() => !future && setHoverDate(ds)}
                                onMouseLeave={() => setHoverDate('')}
                                className={`
                                    w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl text-[10px] font-bold transition-all duration-300 flex items-center justify-center relative
                                    ${future ? 'opacity-10 cursor-not-allowed' : 'cursor-pointer'}
                                    ${(from || to) && !future
                                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 scale-105 z-10 font-black'
                                        : !future ? 'hover:bg-orange-500/10 text-[var(--theme-text-main)] hover:scale-110 active:scale-90' : 'text-[var(--theme-text-muted)]'}
                                    ${isToday && !from && !to ? 'text-orange-500 border border-orange-500/30' : ''}
                                `}
                            >
                                {d}
                                {isToday && !from && !to && (
                                    <span className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-orange-500 rounded-full border-2 border-white dark:border-[var(--theme-bg-card)]" />
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const CalendarRangePicker = ({ fromDate, toDate, onApply, onClear }) => {
    const today = toYMD(new Date());
    const [viewDate, setViewDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d;
    });
    const [hoverDate, setHoverDate] = useState('');

    const navigate = (m) => {
        const next = new Date(viewDate);
        next.setMonth(next.getMonth() + m);
        setViewDate(next);
    };

    const vy = viewDate.getFullYear();
    const vm = viewDate.getMonth();

    const months = [
        { y: vy, m: vm }
    ];

    const handleDayClick = (ds) => {
        if (!fromDate || (fromDate && toDate)) {
            onApply(ds, '');
        } else {
            if (ds === fromDate) {
                onApply(ds, ds, true);
            } else if (ds > fromDate) {
                onApply(fromDate, ds, true);
            } else {
                onApply(ds, fromDate, true);
            }
        }
    };

    const isLatest = vy === new Date().getFullYear() && vm === new Date().getMonth();

    return (
        <div className="w-full text-[var(--theme-text-main)]">
            <div className="flex items-center justify-between mb-6 gap-3 px-1">
                <button 
                    onClick={() => navigate(-1)}
                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-[var(--theme-bg-deep)] border border-[var(--theme-border)] text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-sm active:scale-90"
                >
                    <ChevronLeft size={16} strokeWidth={3} />
                </button>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/5 border border-orange-500/10">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">History</span>
                </div>
                <button 
                    onClick={() => navigate(1)}
                    disabled={isLatest}
                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-[var(--theme-bg-deep)] border border-[var(--theme-border)] text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-sm active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={16} strokeWidth={3} />
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-8 md:gap-12 justify-center">
                {months.map((m, idx) => (
                    <MonthGrid 
                        key={idx}
                        year={m.y}
                        month={m.m}
                        today={today}
                        fromDate={fromDate}
                        toDate={toDate}
                        hoverDate={hoverDate}
                        onDayClick={handleDayClick}
                        setHoverDate={setHoverDate}
                    />
                ))}
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-[var(--theme-border)] pt-4">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-orange-500/50 uppercase tracking-widest mb-0.5">Status</span>
                    <p className="text-xs font-bold text-[var(--theme-text-muted)]">
                        {fromDate && !toDate ? 'Choose an end date' : 'Select a range or single date'}
                    </p>
                </div>
                <button 
                    onClick={onClear}
                    className="px-4 py-2 rounded-xl bg-[var(--theme-bg-deep)] border border-[var(--theme-border)] text-[10px] font-black uppercase tracking-widest hover:text-red-500 transition-colors active:scale-95"
                >
                    Reset
                </button>
            </div>
        </div>
    );
};

const DATE_RANGES = [
    { label: 'Today', value: 'today' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
];

function getDateRange(rangeValue, customFrom, customTo) {
    const now = new Date();
    if (rangeValue === 'custom' && customFrom) {
        const from = new Date(customFrom);
        const to = customTo ? new Date(customTo) : from;
        return {
            start: new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0),
            end: new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999),
        };
    }
    if (rangeValue === 'today') {
        return {
            start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
            end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
        };
    }
    if (rangeValue === 'week') {
        const day = now.getDay();
        const start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0, 0, 0, 0);
        const end = new Date(now); end.setDate(now.getDate() + (6 - day)); end.setHours(23, 59, 59, 999);
        return { start, end };
    }
    if (rangeValue === 'month') {
        return {
            start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
        };
    }
    if (rangeValue === 'year') {
        return {
            start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
            end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
        };
    }
    return null;
}

const AdminOrders = () => {
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [dateRange, setDateRange] = useState('today');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [cancelModal, setCancelModal] = useState({ isOpen: false, order: null });
    const datePickerRef = useRef(null);
    const { user, formatPrice, socket, settings } = useContext(AuthContext);
    const location = useLocation();

    // ── External URL auto-sync (Open order from Search) ──────────────────────
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const orderId = params.get('id');
        if (orderId && orders.length > 0) {
            const found = orders.find(o => o._id === orderId);
            if (found) {
                // To be safe, if we arrive with an ID, we switch to a broader list or just show the order
                setDateRange('year'); 
                setSelectedOrder(found);
            }
        }
    }, [location.search, orders]);

    const fetchOrders = useCallback(async () => {
        if (!navigator.onLine) {
            const [cached, pending] = await Promise.all([getCachedOrders(), getPendingOrders()]);
            setOrders([...(pending || []), ...(cached || [])]);
            return;
        }
        try {
            const res = await api.get('/orders', {
                params: { limit: 100 }
            });
            setOrders(res.data.orders || []);
        } catch (error) {
            console.error("Error fetching orders", error);
            const cached = await getCachedOrders();
            setOrders(cached || []);
        }
    }, [user]);

    useEffect(() => {
        fetchOrders();

        if (socket) {
            const handleUpdate = (o) => setOrders(prev => {
                const exists = prev.find(x => x._id === o._id);
                return exists ? prev.map(x => x._id === o._id ? o : x) : [o, ...prev];
            });
            const handleNew = (o) => setOrders(prev =>
                prev.find(x => x._id === o._id) ? prev : [o, ...prev]
            );

            socket.on('new-order', handleNew);
            socket.on('order-updated', handleUpdate);
            socket.on('order-completed', handleUpdate);
            socket.on('orderCancelled', handleUpdate);
            socket.on('itemUpdated', handleUpdate);

            return () => {
                socket.off('new-order', handleNew);
                socket.off('order-updated', handleUpdate);
                socket.off('order-completed', handleUpdate);
                socket.off('orderCancelled', handleUpdate);
                socket.off('itemUpdated', handleUpdate);
            };
        }
    }, [user, socket, fetchOrders]);

    useEffect(() => {
        let temp = [...orders];

        const range = getDateRange(dateRange, fromDate, toDate);
        if (range) {
            temp = temp.filter(o => {
                const d = new Date(o.createdAt);
                return d >= range.start && d <= range.end;
            });
        }

        if (searchQuery) {
            temp = temp.filter(o => {
                const displayNum = `${o.orderType === 'dine-in' ? 'DI' : 'TK'}-${String(o.orderNumber).startsWith('ORD-') ? String(o.orderNumber).replace('ORD-', '') : o.orderNumber}`;
                return displayNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    o.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    o.customerInfo?.name?.toLowerCase().includes(searchQuery.toLowerCase());
            });
        }

        // Global setting filter: Hide takeaway/dine-in from history if disabled
        if (settings?.takeawayEnabled === false || settings?.takeawayEnabled === 0) {
            temp = temp.filter(o => o.orderType !== 'takeaway');
        }
        if (settings?.dineInEnabled === false || settings?.dineInEnabled === 0) {
            temp = temp.filter(o => o.orderType !== 'dine-in');
        }

        setFilteredOrders(temp);
    }, [orders, dateRange, fromDate, toDate, searchQuery]);

    const applyDateRange = (from, to, shouldClose = false) => {
        setFromDate(from);
        setToDate(to || '');
        setDateRange('custom');
        if (shouldClose) setShowDatePicker(false);
    };

    const clearCustomDate = () => {
        setFromDate('');
        setToDate('');
        setDateRange('today');
        setShowDatePicker(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleProcessPayment = async (order) => {
        const displayOrderNum = order.orderType === 'dine-in' ? 'DI' : 'TK' + '-' + (String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber);
        if (!window.confirm(`Process payment of ${formatPrice(order.finalAmount)} for ${displayOrderNum}?`)) return;

        try {
            const res = await api.put(`/orders/${order._id}/payment`, {
                paymentMethod: 'cash',
                amountPaid: order.finalAmount
            });

            if (res.data.success) {
                const updatedOrder = res.data.order;
                setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
                setSelectedOrder(updatedOrder);
            }
        } catch (error) {
            console.error("Payment error:", error);
            alert("Failed to process payment");
        }
    };

    const handleCancelOrder = async (orderId, reason) => {
        await api.put(`/orders/${orderId}/cancel`, { reason }, { headers: { Authorization: `Bearer ${user.token}` } });
    };

    const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const activeLabel = dateRange === 'custom' && fromDate
        ? toDate && toDate !== fromDate ? `${fmt(fromDate)} – ${fmt(toDate)}` : fmt(fromDate)
        : DATE_RANGES.find(r => r.value === dateRange)?.label || 'Today';

    return (
        <div className="flex h-full w-full overflow-hidden animate-fade-in text-[var(--theme-text-main)]">

        {/* ── Left: Orders list (independent scroll) ──────────────────── */}
        <div className="flex-1 w-full min-w-0 kot-scroll pb-40 animate-fade-in custom-scrollbar p-3 sm:p-6 space-y-6">
            <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[var(--theme-bg-card)] p-5 sm:p-6 rounded-3xl shadow-xl border border-[var(--theme-border)] w-full ${selectedOrder ? 'lg:hidden' : ''}`}>
                <div className="shrink-0 text-center sm:text-left">
                    <h2 className="text-xl sm:text-2xl font-black text-[var(--theme-text-main)] whitespace-nowrap">Order History</h2>
                    <p className="text-[10px] sm:text-xs text-[var(--theme-text-muted)] mt-1 whitespace-nowrap opacity-70">
                        {activeLabel}
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 flex-1">
                    {/* Search bar */}
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" size={16} />
                        <input
                            type="text"
                            placeholder="Search Order ID..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-[var(--theme-bg-deep)] text-[var(--theme-text-main)] rounded-2xl pl-10 pr-4 py-2.5 border border-[var(--theme-border)] focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none text-sm font-medium"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Quick date range buttons */}
                    <div className="flex items-center gap-1 bg-[var(--theme-bg-deep)] p-1 rounded-2xl border border-[var(--theme-border)] overflow-x-auto no-scrollbar scroll-smooth">
                        {DATE_RANGES.map(r => (
                            <button
                                key={r.value}
                                onClick={() => { setDateRange(r.value); setFromDate(''); setToDate(''); setShowDatePicker(false); }}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${dateRange === r.value
                                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 scale-[1.02]'
                                        : 'text-[var(--theme-text-muted)] hover:text-orange-500 hover:bg-orange-500/5'
                                    }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    {/* Date range picker */}
                    <div className="relative flex items-center" ref={datePickerRef}>
                        <button
                            onClick={() => setShowDatePicker(v => !v)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all duration-200 ${dateRange === 'custom'
                                    ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/30'
                                    : 'bg-[var(--theme-bg-deep)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]'
                                }`}
                        >
                            <Calendar size={16} />
                            <span className="text-xs font-bold whitespace-nowrap">
                                {dateRange === 'custom' && fromDate
                                    ? toDate && toDate !== fromDate
                                        ? `${new Date(fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                                        : new Date(fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                    : 'Pick Date'}
                            </span>
                        </button>

                        {dateRange === 'custom' && fromDate && (
                            <button
                                onClick={clearCustomDate}
                                className="ml-1 p-1.5 rounded-xl bg-[var(--theme-bg-deep)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-red-500 transition-colors"
                            >
                                <X size={13} />
                            </button>
                        )}

                        {/* Premium Responsive Date Picker Modal */}
                        {showDatePicker && (
                            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
                                {/* Backdrop */}
                                <div className="fixed inset-0 bg-black/20 backdrop-blur-md" onClick={() => setShowDatePicker(false)} />
                                
                                <div className="relative z-10 bg-[var(--theme-bg-card)] sm:border border-[var(--theme-border)] rounded-t-[24px] sm:rounded-[24px] shadow-[0_25px_80px_-12px_rgba(0,0,0,0.4)] p-5 w-full sm:w-[360px] max-h-[90vh] sm:max-h-[unset] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex flex-col">
                                            <h3 className="text-[8px] font-black text-orange-500 uppercase tracking-[0.3em] mb-0.5">Select Range</h3>
                                            <p className="text-lg font-black text-[var(--theme-text-main)]">Custom Period</p>
                                        </div>
                                        <button 
                                            onClick={() => setShowDatePicker(false)} 
                                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--theme-bg-deep)] text-[var(--theme-text-muted)] hover:text-red-500 transition-all active:scale-95"
                                        >
                                            <X size={18} strokeWidth={3} />
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <CalendarRangePicker
                                            fromDate={fromDate}
                                            toDate={toDate}
                                            onApply={applyDateRange}
                                            onClear={clearCustomDate}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-[var(--theme-bg-card)] rounded-3xl shadow-xl border border-[var(--theme-border)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--theme-bg-deep)] text-[var(--theme-text-muted)] uppercase text-[9px] sm:text-[10px] font-black tracking-widest border-b border-[var(--theme-border)]">
                            <tr>
                                <th className="px-3 sm:px-6 py-4">Order Info</th>
                                <th className="px-4 sm:px-6 py-4 hidden sm:table-cell">Type</th>
                                <th className="px-4 py-4 text-center hidden md:table-cell">Items</th>
                                <th className="px-3 py-4">Amount</th>
                                <th className="px-3 py-4">Status</th>
                                <th className="px-4 sm:px-6 py-4 text-right pr-6 sm:pr-10 hidden xs:table-cell">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--theme-border)]">
                            {filteredOrders.length > 0 ? (
                                filteredOrders.map(order => (
                                    <tr
                                        key={order._id}
                                        onClick={() => setSelectedOrder(order)}
                                        className={`group transition-all duration-300 border-b border-[var(--theme-border)] cursor-pointer ${tokenColors[order.orderStatus] || 'hover:bg-[var(--theme-bg-hover)]'}`}
                                    >
                                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5 mb-1">
                                                    <span className="font-black text-inherit text-[11px] sm:text-sm tracking-tight truncate">{order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}</span>
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-black/5 text-[8px] font-black uppercase border border-current/10 w-fit">
                                                        {order.orderType === 'dine-in' ? `T${order.tableId?.number || order.tableId || '?'}` : `TK${order.tokenNumber || '?'}`}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] sm:text-[10px] text-inherit opacity-60 font-medium italic whitespace-nowrap">
                                                    {new Date(order.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center justify-center min-w-[36px] h-7 font-black text-inherit px-2 bg-black/5 rounded-lg border border-current/10 shadow-sm text-[10px] whitespace-nowrap">
                                                    {order.orderType === 'dine-in' ? `T${order.tableId?.number || order.tableId || '?'}` : `TK${order.tokenNumber || '?'}`}
                                                </span>
                                                <span className="text-[10px] font-black uppercase opacity-60 tracking-wider whitespace-nowrap">
                                                    {order.orderType}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 sm:py-4 text-center hidden md:table-cell">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/5 border border-current/10 font-black text-xs">
                                                {order.items?.length || 0}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 sm:py-4">
                                            <span className="font-black text-inherit text-[11px] sm:text-sm tabular-nums whitespace-nowrap">
                                                {formatPrice(order.finalAmount)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 sm:py-4">
                                            <StatusBadge status={order.orderStatus} size="xs" />
                                        </td>
                                        <td className="px-4 sm:px-6 py-3 sm:py-4 text-right pr-4 hidden xs:table-cell">
                                            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-inherit opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                Details <ChevronRight size={14} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500 opacity-50">
                                            <ShoppingBag size={48} className="mb-4" />
                                            <p className="text-lg font-bold">No orders found</p>
                                            <p className="text-sm">Try a different date range or search term</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>

        {/* ── Universal Order Details Modal ────────────────────────────── */}
        <OrderDetailsModal
            isOpen={!!selectedOrder}
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            formatPrice={formatPrice}
            onProcessPayment={handleProcessPayment}
            onCancelOrder={(o) => setCancelModal({ isOpen: true, order: o })}
            userRole={user?.role}
            settings={settings}
        />

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

export default AdminOrders;
