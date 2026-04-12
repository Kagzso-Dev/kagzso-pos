import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import {
    TrendingUp, TrendingDown, ShoppingBag, Clock, DollarSign, IndianRupee,
    Download, RefreshCw, ChevronDown, FileText,
    Layers, Utensils, Package, LogOut
} from 'lucide-react';
import * as XLSX from 'xlsx';

import NotificationBell from '../../components/NotificationBell';

/* ── Skeleton Card ───────────────────────────────────────────────────────── */
const SkeletonCard = () => (
    <div className="bg-[var(--theme-bg-card)] p-5 rounded-2xl border border-[var(--theme-border)] space-y-3">
        <div className="skeleton skeleton-text w-24 h-3" />
        <div className="skeleton skeleton-text w-32 h-8" />
        <div className="skeleton skeleton-text w-16 h-3" />
    </div>
);

/* ── Growth Badge ────────────────────────────────────────────────────────── */
const GrowthBadge = ({ growth, loading }) => {
    if (loading) {
        return <span className="skeleton skeleton-text w-14 h-5 rounded-full inline-block" />;
    }
    if (growth === null) return null;

    const isPositive = growth >= 0;
    const isZero = growth === 0;

    return (
        <span className={`
            inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full
            ${isZero
                ? 'bg-gray-500/10 text-gray-400'
                : isPositive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
            }
        `}>
            {isZero ? null : isPositive
                ? <TrendingUp size={11} />
                : <TrendingDown size={11} />
            }
            {isZero ? '–' : `${isPositive ? '+' : ''}${growth}%`}
        </span>
    );
};

/* ── Stat Card ───────────────────────────────────────────────────────────── */
const StatCard = ({ title, value, subtitle, icon: Icon, color, badge }) => {
    // Dynamic Tailwind class helper (since color is a string variable)
    const colorMap = {
        orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-orange-500/5',
        blue:   'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-blue-500/5',
        amber:  'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/5',
        emerald:'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5',
    };
    const c = colorMap[color] || colorMap.orange;

    return (
        <div className="bg-[var(--theme-bg-card)] p-4 sm:p-5 rounded-[1.5rem] border border-[var(--theme-border)] hover:border-orange-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-black/5 group cursor-default">
            <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border ${c} transition-transform group-hover:scale-110 duration-500`}>
                    <Icon size={20} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col items-end">
                    {badge}
                </div>
            </div>
            <div>
                <p className="text-[9px] text-[var(--theme-text-muted)] uppercase font-black tracking-[0.15rem] mb-1 opacity-60">
                    {title}
                </p>
                <div className="flex items-baseline gap-1">
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-[var(--theme-text-main)] tracking-tighter whitespace-nowrap leading-none">
                        {value}
                    </h3>
                </div>
                {subtitle && <p className="text-[10px] text-[var(--theme-text-subtle)] mt-1.5 font-medium opacity-80">{subtitle}</p>}
            </div>
        </div>
    );
};

/* ── Status Badge ────────────────────────────────────────────────────────── */
const statusColors = {
    completed: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    pending: 'bg-[var(--status-pending-bg)] text-[var(--status-pending)] border border-[var(--status-pending-border)]',
    preparing: 'bg-[var(--status-preparing-bg)] text-[var(--status-preparing)] border border-[var(--status-preparing-border)]',
    accepted: 'bg-[var(--status-accepted-bg)] text-[var(--status-accepted)] border border-[var(--status-accepted-border)]',
    ready: 'bg-[var(--status-ready-bg)] text-[var(--status-ready)] border border-[var(--status-ready-border)]',
    cancelled: 'bg-red-500/10 text-red-500 border border-red-500/20',
};

const AdminDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    // Growth state
    const [growth, setGrowth] = useState(null);
    const [growthLoading, setGrowthLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dbStats, setDbStats] = useState(null);
    const [dbSummary, setDbSummary] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [filterType, setFilterType] = useState('all'); // 'all', 'dine-in', 'takeaway'
    const [offlinePayments, setOfflinePayments] = useState([]);


    const PER_PAGE = 10;
    const { user, socket, formatPrice, settings } = useContext(AuthContext);
    const navigate = useNavigate();

    /* ── Fetch Orders ─────────────────────────────────────────────────── */
    const fetchOrders = useCallback(async (forceRefresh = false) => {
        try {
            setLoading(true);
            if (forceRefresh) setRefreshing(true);
            const refreshQuery = forceRefresh ? "?refresh=true" : "";
            const res = await api.get(`/api/orders${refreshQuery}`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            // res.data is { orders, pagination }
            setOrders(res.data.orders || []);
            console.log('[Dashboard] Orders fetched from DB:', res.data.orders?.length ?? 0);
        } catch (err) {
            console.error('Error fetching orders', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    /* ── Fetch DB Stats ────────────────────────────────────────────────── */
    const fetchStats = useCallback(async (forceRefresh = false) => {
        if (user?.role !== 'admin') return;
        const refreshQuery = forceRefresh ? '?refresh=true' : '';
        try {
            setStatsLoading(true);
            const [statsRes, summaryRes] = await Promise.allSettled([
                api.get(`/api/dashboard/stats${refreshQuery}`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                }),
                api.get(`/api/analytics/summary?range=month${refreshQuery}`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                }),
            ]);
            if (statsRes.status === 'fulfilled') {
                setDbStats(statsRes.value.data);
            } else {
                console.error('[Dashboard] stats fetch failed:', statsRes.reason?.message);
            }
            if (summaryRes.status === 'fulfilled') {
                setDbSummary(summaryRes.value.data);
            } else {
                console.error('[Dashboard] summary fetch failed:', summaryRes.reason?.message);
            }
        } finally {
            setStatsLoading(false);
        }
    }, [user]);

    /* ── Fetch Growth ─────────────────────────────────────────────────── */
    const fetchGrowth = useCallback(async (forceRefresh = false) => {
        // Only fetch for admin role
        if (user?.role !== 'admin') return;
        setGrowthLoading(true);
        const refreshQuery = forceRefresh ? "?refresh=true" : "";
        try {
            const res = await api.get(`/api/dashboard/growth${refreshQuery}`, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            setGrowth(res.data.growth ?? 0);
        } catch (err) {
            console.error('[AdminDashboard] Growth fetch failed:', err.message);
            setGrowth(null); // silently fail — badge disappears
        } finally {
            setGrowthLoading(false);
        }
    }, [user]);

    /* ── Handle Refresh (orders + DB stats + growth) ─────────────────── */
    const handleRefresh = useCallback(() => {
        fetchOrders(true);
        fetchStats(true);
        fetchGrowth(true);
    }, [fetchOrders, fetchStats, fetchGrowth]);

    useEffect(() => {
        fetchOrders();
        fetchStats();
        fetchGrowth();

        const onNew = (o) => {
            setOrders(p => [o, ...p]);
            fetchStats(true); // Re-fetch stats when new order comes
        };
        const onUpdate = (o) => {
            setOrders(p => p.map(x => x._id === o._id ? o : x));
            fetchStats(true);
        };

        if (socket) {
            socket.on('new-order', onNew);
            socket.on('order-updated', onUpdate);
            socket.on('order-completed', onUpdate);
            socket.on('orderCancelled', onUpdate);
            socket.on('payment-success', () => fetchStats(true));
        }

        window.addEventListener('pos-refresh', handleRefresh);

        return () => {
            window.removeEventListener('pos-refresh', handleRefresh);
            if (socket) {
                socket.off('new-order', onNew);
                socket.off('order-updated', onUpdate);
                socket.off('order-completed', onUpdate);
                socket.off('orderCancelled', onUpdate);
                socket.off('payment-success', () => fetchStats(true));
            }
        };
    }, [user, socket, fetchOrders, fetchStats, fetchGrowth, handleRefresh]);

    /* ── Check for offline payments ──────────────────────────────────────── */
    useEffect(() => {
        const checkOffline = () => {
            const pending = JSON.parse(localStorage.getItem('pendingPayments') || '[]');
            const pendingOffline = pending.filter(p => p.status === 'pending');
            setOfflinePayments(pendingOffline);
        };
        checkOffline();
        const interval = setInterval(checkOffline, 10000);
        const handleOnline = () => checkOffline();
        window.addEventListener('online', handleOnline);
        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    /* ── DB-backed stat values (from MySQL via API) ───────────────────── */
    // dbStats.today.active/completed/cancelled/revenue from /api/dashboard/stats
    // dbSummary.totalRevenue/orderCount/avgOrderValue from /api/analytics/summary
    const activeCount   = dbStats?.today?.active    ?? 0;
    const completedCount = dbStats?.today?.completed ?? 0;
    const allTimeCount  = dbStats?.allTime           ?? 0;
    const totalRevenue  = dbSummary?.totalRevenue    ?? 0;
    const avgOrderValue = dbSummary?.avgOrderValue   ?? 0;
    const orderCount    = dbSummary?.orderCount      ?? 0;

    /* ── Filtered & Paginated Orders ─────────────────────────────────── */
    const filteredOrders = useMemo(() => {
        if (filterType === 'all') return orders;
        return orders.filter(o => o.orderType?.toLowerCase() === filterType.toLowerCase());
    }, [orders, filterType]);

    const paginated = useMemo(() => {
        const start = (page - 1) * PER_PAGE;
        return filteredOrders.slice(start, start + PER_PAGE);
    }, [filteredOrders, page]);

    const totalPages = Math.ceil(filteredOrders.length / PER_PAGE);

    // Reset to page 1 when filter changes
    useEffect(() => {
        setPage(1);
    }, [filterType]);

    /* ── Excel Export ─────────────────────────────────────────────────── */
    const exportExcel = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary
        const summaryData = [
            ['Kagzso Dashboard Report'],
            ['Generated', new Date().toLocaleString()],
            [],
            ['Metric', 'Value'],
            ['Total Revenue (30d)', totalRevenue],
            ['Active Orders', activeCount],
            ['Completed Today', completedCount],
            ['Avg Order Value', avgOrderValue],
            ['Total Orders (30d)', orderCount],
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        // Sheet 2: Orders
        const ordersData = [
            ['Order ID', 'Type', 'Items', 'Status', 'Date', 'Amount'],
            ...orders.map(o => [
                `${o.orderType === 'dine-in' ? 'DI' : 'TK'}-${String(o.orderNumber).startsWith('ORD-') ? String(o.orderNumber).replace('ORD-', '') : o.orderNumber}`,
                o.orderType,
                o.items?.length ?? 0,
                o.orderStatus,
                new Date(o.createdAt).toLocaleDateString(),
                o.finalAmount,
            ]),
        ];
        const wsOrders = XLSX.utils.aoa_to_sheet(ordersData);
        XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders');

        XLSX.writeFile(wb, `Kagzso_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`);
    };


    return (
        <div className="space-y-5 animate-fade-in">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 bg-[var(--theme-bg-card2)] rounded-3xl p-5 sm:p-6 border border-[var(--theme-border)] shadow-xl">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-[var(--theme-text-main)] uppercase tracking-tighter leading-tight flex items-center">
                        KAGZSO
                        <span className="text-white font-black ml-2 text-xs sm:text-base uppercase tracking-widest px-2 py-0.5 bg-[var(--theme-bg-dark)] rounded-lg border border-[var(--theme-border)] shadow-inner">
                            Analytics
                        </span>
                    </h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <NotificationBell />
                    {/* Mobile: Logout | Desktop/Tablet: Refresh */}

                    <button
                        onClick={exportExcel}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-500/30 min-h-[44px] whitespace-nowrap"
                    >
                        <Download size={14} />
                        <span>Export</span>
                    </button>
                </div>
            </div>

            {/* ── Offline Payments Alert ───────────────────────────────────── */}
            {offlinePayments.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <Clock size={20} className="text-amber-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-400">
                                {offlinePayments.length} Offline Payment{offlinePayments.length > 1 ? 's' : ''} Pending Sync
                            </p>
                            <p className="text-[10px] text-amber-400/70">
                                These payments were completed offline and will sync when connection is restored
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            const pending = JSON.parse(localStorage.getItem('pendingPayments') || '[]');
                            alert(`Pending: ${pending.length} payment(s)\nStatus: pending`);
                        }}
                        className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-bold"
                    >
                        View Details
                    </button>
                </div>
            )}

            {/* ── Stats Grid — values sourced from MySQL via API ─────── */}
            {/* Mobile: 1-col → xs: 2-col → md: 2-col (iPad Mini) → xl: 4-col */}
            <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
                {statsLoading ? (
                    Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
                ) : (
                    <>
                        {/* Total Revenue — MySQL: SUM(final_amount) WHERE payment_status='paid' */}
                        <StatCard
                            title="Total Revenue (30d)"
                            value={formatPrice(totalRevenue)}
                            subtitle={null}
                            icon={settings?.currencySymbol === '₹' ? IndianRupee : DollarSign}
                            color="orange"
                            badge={
                                <div className="flex flex-col items-end gap-1">
                                    <GrowthBadge growth={growth} loading={growthLoading} />
                                    {!growthLoading && growth !== null && (
                                        <span className="text-[9px] text-[var(--theme-text-subtle)] font-bold uppercase tracking-tight opacity-60">vs yesterday</span>
                                    )}
                                </div>
                            }
                        />
                        {/* Active — MySQL: COUNT(*) WHERE order_status IN ('pending','accepted','preparing','ready') */}
                        <StatCard
                            title="Active Orders"
                            value={activeCount}
                            subtitle={null}
                            icon={ShoppingBag}
                            color="blue"
                            badge={
                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    Live
                                </span>
                            }
                        />
                        {/* Completed — MySQL: COUNT(*) WHERE order_status='completed' (today) */}
                        <StatCard
                            title="Completed Today"
                            value={completedCount}
                            subtitle={null}
                            icon={Clock}
                            color="amber"
                            badge={null}
                        />
                        {/* Avg — MySQL: AVG(final_amount) WHERE payment_status='paid' */}
                        <StatCard
                            title="Avg Order Value"
                            value={formatPrice(avgOrderValue)}
                            subtitle={null}
                            icon={TrendingUp}
                            color="emerald"
                            badge={null}
                        />
                    </>
                )}
            </div>

            {/* ── Orders Table ────────────────────────────────────────── */}
            <div className="bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--theme-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-[var(--theme-text-main)]">Recent Orders</h2>
                    </div>
                    <div className="flex bg-[var(--theme-bg-dark)] p-1 rounded-2xl border border-[var(--theme-border)] shadow-inner">
                        {[
                            { id: 'all',      icon: <Layers size={13} />,   label: 'All' },
                            { id: 'dine-in',  icon: <Utensils size={13} />, label: 'Dine In' },
                            { id: 'takeaway', icon: <Package size={13} />,  label: 'Takeaway' }
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => setFilterType(btn.id)}
                                className={`
                                    flex items-center gap-1.5 px-3 xs:px-4 py-2 rounded-xl text-[9px] xs:text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap
                                    ${filterType === btn.id 
                                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                                        : 'text-[var(--theme-text-muted)] hover:text-orange-500 hover:bg-orange-500/5'}
                                `}
                            >
                                {btn.icon}
                                <span>{btn.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Scrollable table container */}
                <div className="table-wrap">
                    {loading ? (
                        <div className="p-6 space-y-3">
                            {Array(5).fill(0).map((_, i) => (
                                <div key={i} className="skeleton h-10 rounded-lg" />
                            ))}
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                            <ShoppingBag size={48} className="mb-3 opacity-20" />
                            <p className="font-medium">No orders yet</p>
                            <p className="text-sm">Orders will appear here as they come in</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm text-[var(--theme-text-muted)]">
                            <thead className="bg-[var(--theme-bg-hover)] text-[var(--theme-text-subtle)] text-xs uppercase font-semibold tracking-wider">
                                <tr>
                                    <th className="px-3 sm:px-5 py-3">Order ID</th>
                                    <th className="px-3 sm:px-5 py-3 hidden xs:table-cell">Type</th>
                                    <th className="px-3 sm:px-5 py-3 hidden sm:table-cell">Items</th>
                                    <th className="px-3 sm:px-5 py-3">Status</th>
                                    <th className="px-3 sm:px-5 py-3 hidden md:table-cell">Date</th>
                                    <th className="px-3 sm:px-5 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--theme-border)]">
                                {paginated.map(order => {
                                    const isRecent = (Date.now() - new Date(order.createdAt)) < 3600000;
                                    const isActive = ['pending', 'accepted', 'preparing', 'ready'].includes(order.orderStatus?.toLowerCase());
                                    
                                    return (
                                        <tr key={order._id} className="group hover:bg-[var(--theme-bg-hover)] transition-all duration-200">
                                            <td className="px-5 py-4 font-black text-[var(--theme-text-main)] whitespace-nowrap text-xs sm:text-sm tracking-tight">
                                                <div className="flex items-center gap-2">
                                                    {isRecent && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                                                    {order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 hidden xs:table-cell">
                                                <span className={`px-2 py-0.5 rounded-lg text-[8px] xs:text-[9px] font-black uppercase tracking-wider border whitespace-nowrap ${
                                                    order.orderType === 'dine-in' 
                                                        ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' 
                                                        : 'bg-blue-500/5 text-blue-400 border-blue-500/20'
                                                }`}>
                                                    {order.orderType}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 hidden sm:table-cell text-xs sm:text-sm font-bold text-[var(--theme-text-muted)]">
                                                {order.items?.length || 0} <span className="text-[10px] uppercase tracking-wide opacity-50 ml-0.5">items</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    {isActive && <div className="w-1 h-1 rounded-full bg-orange-500 animate-ping" />}
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] xs:text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${statusColors[order.orderStatus?.toLowerCase()] || ''}`}>
                                                        {order.orderStatus}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap hidden md:table-cell text-[10px] sm:text-xs font-bold text-[var(--theme-text-subtle)] uppercase tracking-tight">
                                                {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-5 py-4 text-right font-black text-orange-500 whitespace-nowrap text-xs sm:text-sm tracking-tighter">
                                                {formatPrice(order.finalAmount)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-5 py-3 border-t border-[var(--theme-border)] flex items-center justify-between">
                        <p className="text-xs text-[var(--theme-text-subtle)]">
                            Page {page} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-2 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-2 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] rounded-xl text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
