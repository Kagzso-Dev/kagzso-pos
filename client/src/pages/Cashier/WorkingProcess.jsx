import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
const logoImg = '/logo.png';
import { Printer, ChefHat, List, Grid, RefreshCw, Clock, CheckCircle, Play, Timer, X } from 'lucide-react';

const WorkingProcess = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const { user, socket, formatPrice, settings } = useContext(AuthContext);

    const [filterType, setFilterType] = useState('all');
    const [statusFilter, setStatusFilter] = useState(null);
    const [isGridView, setIsGridView] = useState(true);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/orders', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            const ordersArray = res.data.orders || [];
            setOrders(ordersArray.filter(o => ['pending', 'preparing', 'accepted', 'ready'].includes(o.orderStatus)));
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) fetchOrders();

        if (!socket) return;

        const onNewOrder = (newOrder) => {
            setOrders(prev => prev.find(o => o._id === newOrder._id) ? prev : [newOrder, ...prev]);
        };

        const onOrderUpdated = (updatedOrder) => {
            const isDone = ['completed', 'cancelled'].includes(updatedOrder.orderStatus);
            setOrders(prev => {
                const existing = prev.find(o => o._id === updatedOrder._id);
                if (isDone) return prev.filter(o => o._id !== updatedOrder._id);
                if (existing) return prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
                return [updatedOrder, ...prev];
            });
            // Update selectedOrder without needing it in deps — compare by id at call time
            setSelectedOrder(prev => {
                if (!prev || prev._id !== updatedOrder._id) return prev;
                return isDone ? null : updatedOrder;
            });
        };

        socket.on('new-order', onNewOrder);
        socket.on('order-updated', onOrderUpdated);
        socket.on('itemUpdated', onOrderUpdated);

        return () => {
            socket.off('new-order', onNewOrder);
            socket.off('order-updated', onOrderUpdated);
            socket.off('itemUpdated', onOrderUpdated);
        };
    }, [user, socket, fetchOrders]);

    useEffect(() => {
        window.addEventListener('pos-refresh', fetchOrders);
        return () => window.removeEventListener('pos-refresh', fetchOrders);
    }, [fetchOrders]);

    const enabledOrders = orders
        .filter(o => settings?.takeawayEnabled !== false || o.orderType !== 'takeaway')
        .filter(o => settings?.dineInEnabled !== false || o.orderType !== 'dine-in');

    const currentTypeOrders = enabledOrders.filter(o => filterType === 'all' || o.orderType === filterType);

    const counts = {
        pending: currentTypeOrders.filter(o => o.orderStatus === 'pending').length,
        accepted: currentTypeOrders.filter(o => o.orderStatus === 'accepted').length,
        preparing: currentTypeOrders.filter(o => o.orderStatus === 'preparing').length,
        ready: currentTypeOrders.filter(o => o.orderStatus === 'ready').length,
    };

    const displayOrders = enabledOrders.filter(o => {
        const matchesType = filterType === 'all' || o.orderType === filterType;
        const matchesStatus = !statusFilter || o.orderStatus === statusFilter;
        return matchesType && matchesStatus;
    });

    // Clear selected order if it's no longer in the filtered list
    useEffect(() => {
        if (selectedOrder && !displayOrders.find(o => o._id === selectedOrder._id)) {
            setSelectedOrder(null);
        }
    }, [filterType, statusFilter, displayOrders, selectedOrder]);

    const printKOT = () => {
        if (!selectedOrder) return;
        const statusColors = {
            pending: '#f59e0b',
            accepted: '#3b82f6',
            preparing: '#8b5cf6',
            ready: '#10b981',
            cancelled: '#ef4444',
        };

        const getItemStatusStyle = (status) => {
            const color = statusColors[status?.toLowerCase()] || '#6b7280';
            return `border:1px solid ${color};color:${color};font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;text-transform:uppercase;`;
        };

        const orderStatusColor = statusColors[selectedOrder.orderStatus?.toLowerCase()] || '#6b7280';

        const itemsHTML = selectedOrder.items.map((item, idx) => `
            <tr style="border-bottom:1px dashed #e5e7eb;">
                <td style="padding:8px 4px;">
                    <span style="font-weight:700;">${item.name}</span>
                    ${item.notes ? `<div style="font-size:11px;color:#6b7280;font-style:italic;margin-top:2px;">Note: ${item.notes}</div>` : ''}
                </td>
                <td style="padding:8px 4px;text-align:center;font-weight:700;font-size:18px;">${item.quantity}</td>
                <td style="padding:8px 4px;text-align:right;">
                    <span style="${getItemStatusStyle(item.status)}">${item.status || ''}</span>
                </td>
            </tr>
        `).join('');

        const tableOrToken = selectedOrder.orderType === 'dine-in'
            ? `TBL ${selectedOrder.tableId?.number || selectedOrder.tableId || '?'}`
            : `TOK ${selectedOrder.tokenNumber}`;

        const orderNum = selectedOrder.orderType === 'dine-in' ? 'DI' : 'TK';
        const ordNum = String(selectedOrder.orderNumber).startsWith('ORD-') ? String(selectedOrder.orderNumber).replace('ORD-', '') : selectedOrder.orderNumber;
        const displayOrderNumber = `${orderNum}-${ordNum}`;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"/>
    <title>KOT - ${displayOrderNumber}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: monospace, sans-serif; background:#fff; color:#000; padding:12px; }
        @page { size: 80mm auto; margin: 5mm; }
    </style>
</head>
<body>
    <div style="max-width:320px;margin:0 auto;position:relative;overflow:hidden;">
        {/* Watermark removed */}
        <div style="text-align:center;border-bottom:2px dashed #d1d5db;padding-bottom:12px;margin-bottom:12px;">
            <h1 style="font-size:22px;font-weight:900;letter-spacing:1px;">KITCHEN ORDER</h1>
            <p style="font-size:11px;font-weight:600;color:#4b5563;text-transform:uppercase;letter-spacing:2px;margin-top:4px;">${selectedOrder.orderType}</p>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:12px;">
            <div>
                <p><strong>Order:</strong> ${displayOrderNumber}</p>
                <p><strong>Time:</strong> ${new Date(selectedOrder.createdAt).toLocaleTimeString()}</p>
            </div>
            <div style="text-align:right;">
                <p style="font-size:18px;font-weight:900;">${tableOrToken}</p>
            </div>
        </div>
        <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:16px;">
            <thead>
                <tr style="border-bottom:2px solid #000;">
                    <th style="padding:4px;text-align:left;">Item</th>
                    <th style="padding:4px;text-align:center;">Qty</th>
                    <th style="padding:4px;text-align:right;">Status</th>
                </tr>
            </thead>
            <tbody>${itemsHTML}</tbody>
        </table>
        <div style="border-top:2px solid #000;padding-top:12px;text-align:center;">
            <p style="font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Order Status</p>
            <div style="font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:2px;padding:8px;border:2px solid ${orderStatusColor};color:${orderStatusColor};">
                ${selectedOrder.orderStatus}
            </div>
        </div>
    </div>
    <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; };<\/script>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=400,height=600');
        win.document.write(html);
        win.document.close();
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'text-[var(--status-pending)] bg-[var(--status-pending-bg)] border-[var(--status-pending-border)]';
            case 'accepted': return 'text-[var(--status-accepted)] bg-[var(--status-accepted-bg)] border-[var(--status-accepted-border)]';
            case 'preparing': return 'text-[var(--status-preparing)] bg-[var(--status-preparing-bg)] border-[var(--status-preparing-border)]';
            case 'ready': return 'text-[var(--status-ready)] bg-[var(--status-ready-bg)] border-[var(--status-ready-border)]';
            default: return 'text-gray-400 bg-gray-900/30 border-gray-700/30';
        }
    };

    return (
        <div className="flex flex-col animate-fade-in flex-1 overflow-hidden min-h-0">
            {/* ── TopBar Portals ────────────────────────────────────────── */}
            {document.getElementById('topbar-portal') && createPortal(
                <div className="flex items-center justify-between w-full px-1">
                    {/* Left: Operational Filters - Refactored to Horizontal Scrollable Tabs */}
                    <div className="flex items-center gap-2">
                        <div 
                            className="flex items-center gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl md:rounded-full border border-[var(--theme-border)] shadow-inner overflow-x-auto no-scrollbar scroll-smooth w-full md:w-auto"
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
                                        className={`flex-shrink-0 px-4 py-1.5 rounded-[20px] text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap active:scale-95 ${
                                            filterType === t 
                                                ? 'bg-orange-600 text-white shadow-md scale-[1.02]' 
                                                : 'text-[var(--theme-text-muted)] hover:text-orange-500 hover:bg-orange-500/5'
                                        }`}
                                    >
                                        {t === 'all' ? 'All' : t === 'dine-in' ? 'Dine' : 'Take'}
                                    </button>
                                ))}
                        </div>
                    </div>

                    {/* Right: Utilities (View Mode, Stats, Refresh) */}
                    <div className="flex items-center gap-1.5 lg:gap-2">
                        {/* View Mode Toggle */}
                        <button
                            onClick={() => setIsGridView(v => !v)}
                            className={`
                                relative flex items-center h-9 lg:h-10 w-9 md:w-20 lg:w-24 rounded-full transition-all duration-300 shadow-inner overflow-hidden border shrink-0
                                ${isGridView
                                    ? 'bg-blue-500/10 border-blue-500/20'
                                    : 'bg-orange-500/10 border-orange-500/20'}
                            `}
                        >
                            <div
                                className={`
                                    absolute top-0.5 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                                    ${isGridView
                                        ? 'left-[calc(100%-34px)] bg-blue-600 rotate-[360deg]'
                                        : 'left-0.5 bg-orange-600 rotate-0'}
                                `}
                            >
                                {isGridView ? <Grid size={14} strokeWidth={3} className="text-white" /> : <List size={14} strokeWidth={3} className="text-white" />}
                            </div>
                            <div className="hidden md:flex absolute inset-0 items-center justify-between px-2.5 pointer-events-none">
                                <span className={`text-[9px] font-black transition-all duration-300 ${isGridView ? 'opacity-0 -translate-x-2' : 'opacity-100 translate-x-6 text-orange-600'}`}>LIST</span>
                                <span className={`text-[9px] font-black transition-all duration-300 ${!isGridView ? 'opacity-0 translate-x-2' : 'opacity-100 -translate-x-6 text-blue-600'}`}>GRID</span>
                            </div>
                        </button>

                        <div className="hidden md:block h-7 w-px bg-[var(--theme-border)] opacity-30 flex-shrink-0" />

                        {/* Quick Stats */}
                        <div className="hidden md:flex items-center gap-1 lg:gap-1.5 bg-[var(--theme-bg-dark)] p-1 rounded-2xl border border-[var(--theme-border)] shadow-inner h-9 lg:h-11 shrink-0 overflow-x-auto no-scrollbar">
                            {[
                                { key: 'pending',   dot: 'bg-[var(--status-pending)]' },
                                { key: 'accepted',  dot: 'bg-[var(--status-accepted)]' },
                                { key: 'preparing', dot: 'bg-[var(--status-preparing)]' },
                                { key: 'ready',     dot: 'bg-[var(--status-ready)]' },
                            ].map((stat) => (
                                <button
                                    key={stat.key}
                                    onClick={() => setStatusFilter(f => f === stat.key ? null : stat.key)}
                                    className={`px-2 lg:px-3.5 rounded-xl flex items-center gap-1 lg:gap-1.5 h-7 lg:h-9 border transition-all duration-200 ${
                                        statusFilter === stat.key
                                            ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 scale-[1.05]'
                                            : 'bg-transparent border-transparent text-[var(--theme-text-muted)] hover:bg-[var(--theme-bg-hover)] hover:text-[var(--theme-text-main)] hover:border-[var(--theme-border)] hover:scale-105 active:scale-95'
                                    }`}
                                >
                                    <span className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${stat.dot} ${statusFilter === stat.key ? 'animate-pulse' : 'opacity-60'}`} />
                                    <span className="text-xs font-black">{counts[stat.key]}</span>
                                </button>
                            ))}
                        </div>


                    </div>
                </div>,
                document.getElementById('topbar-portal')
            )}



            <div className="flex-1 w-full max-w-[1600px] mx-auto p-4 flex flex-col min-h-0 bg-[var(--theme-bg-muted)]/30 rounded-3xl border border-[var(--theme-border)] shadow-inner">
                {/* Order List Container */}
                <div className="flex-1 bg-[var(--theme-bg-card)] rounded-2xl shadow-xl border border-[var(--theme-border)] overflow-hidden flex flex-col min-h-0">
                    <div className="px-6 py-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg-muted)] flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                <Clock size={20} className="text-orange-500" />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black tracking-tighter text-[var(--theme-text-main)] uppercase leading-none">Active Dashboard</h2>
                                <p className="text-[10px] font-bold text-[var(--theme-text-muted)] uppercase tracking-widest mt-1">Live Kitchen Monitoring</p>
                            </div>
                            <span className="ml-2 bg-orange-600/20 text-orange-400 text-xs px-3 py-1 rounded-full font-black ring-1 ring-orange-500/20">{displayOrders.length}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                             {/* Small indicators for status filter can go here if needed */}
                        </div>
                    </div>
                    
                    <div className={`kot-scroll flex-1 p-4 pb-40 animate-fade-in custom-scrollbar transition-all duration-500 ${isGridView ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 content-start' : 'space-y-3'}`}>
                        {displayOrders.map(order => {
                            const tokenLabel = order.orderType === 'dine-in'
                                ? `Table ${order.tableId?.number || order.tableId || '?'}`
                                : `Token ${order.tokenNumber || '?'}`;
                            return isGridView ? (
                                <button
                                    key={order._id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={`group w-full min-h-[140px] rounded-3xl border-2 flex flex-col items-center justify-center p-4 transition-all duration-300 shadow-sm overflow-hidden relative ${
                                        selectedOrder?._id === order._id
                                            ? 'ring-4 ring-orange-500/20 scale-[1.02] shadow-2xl z-10'
                                            : 'hover:-translate-y-1.5 hover:shadow-2xl hover:scale-[1.03] active:scale-95 active:translate-y-0'
                                        } ${order.orderStatus === 'ready' ? 'animate-pulse' : ''} ${getStatusColor(order.orderStatus)}`}
                                >
                                    {/* Top Row: Type & Status */}
                                    <div className="flex items-center justify-between w-full shrink-0 mb-auto">
                                        <span className="text-[9px] uppercase font-black tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                                            {order.orderType === 'dine-in' ? 'DINE' : 'TAKE'}
                                        </span>
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border border-current transition-colors ${selectedOrder?._id === order._id ? 'bg-white text-black border-transparent' : 'bg-white/10 group-hover:bg-white/30'}`}>
                                            {order.orderStatus}
                                        </span>
                                    </div>

                                    {/* Centered Large Label */}
                                    <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0 py-2">
                                        <span className="text-2xl font-black leading-tight tracking-tighter text-center px-1 break-words w-full truncate group-hover:scale-110 transition-transform duration-300 inline-block drop-shadow-sm">
                                            {tokenLabel}
                                        </span>
                                        <span className="text-[8px] font-bold opacity-50 uppercase tracking-[0.2em] mt-1 group-hover:opacity-90 transition-opacity">
                                            {order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}
                                        </span>
                                    </div>

                                    {/* Bottom indicator bar — expands on hover */}
                                    <div className="w-8 group-hover:w-16 h-1 rounded-full bg-current opacity-30 group-hover:opacity-70 shrink-0 mt-auto transition-all duration-300" />
                                </button>
                            ) : (
                                <div
                                    key={order._id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer group flex flex-col ${
                                        selectedOrder?._id === order._id
                                            ? `${getStatusColor(order.orderStatus)} ring-4 ring-offset-2 ring-current z-10 scale-[1.01] shadow-xl`
                                            : 'bg-[var(--theme-bg-dark)] border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]/40 hover:shadow-md hover:-translate-y-0.5 hover:bg-[var(--theme-bg-hover)] active:scale-[0.99] active:translate-y-0'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className={`font-black text-md ${selectedOrder?._id === order._id ? 'text-inherit' : 'text-[var(--theme-text-main)]'}`}>{order.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(order.orderNumber).startsWith('ORD-') ? String(order.orderNumber).replace('ORD-', '') : order.orderNumber}</h3>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-black border border-current ${selectedOrder?._id === order._id ? 'bg-white text-black' : getStatusColor(order.orderStatus)}`}>
                                            {order.orderStatus}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <p className="text-sm font-black uppercase tracking-tight">{tokenLabel}</p>
                                        <p className="text-[10px] font-bold opacity-60">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            );
                        })}
                        {orders.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center h-80 text-[var(--theme-text-muted)] space-y-4 animate-fade-in">
                                <div className="w-20 h-20 bg-[var(--theme-bg-dark)] rounded-full flex items-center justify-center border border-[var(--theme-border)] shadow-xl opacity-50">
                                    <ChefHat size={40} className="text-orange-500" />
                                </div>
                                <p className="text-lg font-bold tracking-tight">No active kitchen orders</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Order Details Modal ─────────────────────────────── */}
                {selectedOrder && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                        {/* Backdrop with intense blur */}
                        <div 
                            className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" 
                            onClick={() => setSelectedOrder(null)} 
                        />
                        
                        {/* Receipt-Only Focused Modal */}
                        <div className="relative z-10 w-full max-w-sm bg-transparent rounded-[2rem] flex flex-col max-h-[90vh] overflow-hidden animate-scale-in group">
                            
                            {/* Floating Close Button */}
                            <button 
                                onClick={() => setSelectedOrder(null)}
                                className="absolute right-2 top-2 z-[1100] w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-gray-400 hover:text-red-500 flex items-center justify-center border border-gray-100 shadow-xl transition-all hover:scale-110 active:scale-90"
                            >
                                <X size={20} strokeWidth={3} /> 
                            </button>

                            {/* Modal Content - Scrollable Receipt Only */}
                            <div className="flex-1 overflow-y-auto kot-scroll pr-1 custom-scrollbar bg-black/5 rounded-[1.5rem] backdrop-blur-sm">
                                <div className="p-4 flex flex-col items-center">
                                    <div id="printable-kot" className="w-full bg-white text-black p-8 shadow-2xl relative rounded-3xl border border-gray-100 isolate overflow-hidden mb-4">
                                        {/* Dynamic Watermark Status */}
                                        <div className="absolute inset-x-0 top-0 h-2 bg-black/5" />
                                        {/* Watermark removed */}

                                        {/* KOT Header */}
                                        <div className="text-center border-b-2 border-dashed border-gray-300 pb-5 mb-5 relative z-10">
                                            <h1 className="text-3xl font-black tracking-tighter">KITCHEN ORDER</h1>
                                            <div className={`inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mt-2 ${selectedOrder.orderType === 'dine-in' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'}`}>
                                                {selectedOrder.orderType}
                                            </div>
                                        </div>

                                        {/* Meta Data - Compact */}
                                        <div className="flex justify-between text-[10px] mb-4 relative z-10 pb-3 border-b border-gray-100">
                                            <div className="text-left space-y-0.5">
                                                <p><span className="font-extrabold opacity-40 uppercase text-[8px]">ID:</span> <span className="font-bold">
                                                    {selectedOrder.orderType === 'dine-in' ? 'DI' : 'TK'}-{String(selectedOrder.orderNumber).startsWith('ORD-') ? String(selectedOrder.orderNumber).replace('ORD-', '') : selectedOrder.orderNumber}
                                                </span></p>
                                                <p><span className="font-extrabold opacity-40 uppercase text-[8px]">Time:</span> <span className="font-bold">{new Date(selectedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></p>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <div className="text-2xl font-black tabular-nums tracking-tighter leading-none mb-0.5">
                                                    {selectedOrder.orderType === 'dine-in' 
                                                        ? (selectedOrder.tableId?.number || selectedOrder.tableId || '?') 
                                                        : (selectedOrder.tokenNumber || '?')}
                                                </div>
                                                <span className="text-[8px] font-extrabold uppercase opacity-40">{selectedOrder.orderType === 'dine-in' ? 'Table' : 'Token'}</span>
                                            </div>
                                        </div>

                                        {/* Items Table - More Compact Rows */}
                                        <table className="w-full text-[12px] text-left mb-6 relative z-10 border-collapse">
                                            <thead>
                                                <tr className="border-b-2 border-black text-[9px] font-black uppercase tracking-widest text-gray-500">
                                                    <th className="py-1">Kitchen Item</th>
                                                    <th className="py-1 text-center w-10">Qty</th>
                                                    <th className="py-1 text-right w-16">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedOrder.items.map((item, idx) => (
                                                    <tr key={idx} className="border-b border-dashed border-gray-200 last:border-0">
                                                        <td className="py-3">
                                                            <div className="flex flex-col">
                                                                <span className="font-extrabold leading-tight">{item.name}</span>
                                                                {item.notes && (
                                                                    <span className="text-[10px] text-gray-400 italic">★ {item.notes}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 text-center font-black text-lg tabular-nums bg-gray-50/30">{item.quantity}</td>
                                                        <td className="py-3 text-right">
                                                            <div className={`inline-block px-1.5 py-0.5 rounded-md border-2 font-black uppercase text-[8px] tracking-tighter ${
                                                                item.status?.toLowerCase() === 'pending' ? 'border-amber-500 text-amber-600 bg-amber-50' :
                                                                item.status?.toLowerCase() === 'preparing' ? 'border-indigo-500 text-indigo-600 bg-indigo-50 animate-pulse' :
                                                                item.status?.toLowerCase() === 'ready' ? 'border-emerald-500 text-emerald-600 bg-emerald-50 animate-bounce' :
                                                                item.status?.toLowerCase() === 'cancelled' ? 'border-red-500 text-red-600 bg-red-50 line-through' :
                                                                'border-gray-200 text-gray-400'
                                                            }`}>
                                                                {item.status?.slice(0, 4)}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Footer Status Bar - Compact */}
                                        <div className="border-t-2 border-black pt-6 text-center relative z-10">
                                            <div className={`text-2xl font-black uppercase tracking-[0.2em] py-3.5 px-4 rounded-2xl border-4 transition-all shadow-xl ${
                                                selectedOrder.orderStatus === 'ready' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' :
                                                selectedOrder.orderStatus === 'preparing' ? 'border-indigo-500 text-indigo-600 bg-indigo-50 animate-pulse' :
                                                'border-amber-500 text-amber-600 bg-amber-50 animate-bounce'
                                            }`}>
                                                {selectedOrder.orderStatus}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inline Actions at the bottom of the scroll area */}
                                    <div className="w-full max-w-sm space-y-3 pb-8">
                                        <button 
                                            onClick={() => { printKOT(); setSelectedOrder(null); }}
                                            className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest rounded-3xl shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95"
                                        >
                                            <Printer size={22} strokeWidth={3} /> Print KOT
                                        </button>
                                        <button 
                                            onClick={() => setSelectedOrder(null)}
                                            className="w-full h-12 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-[0.3em] rounded-3xl backdrop-blur-md border border-white/20 text-[10px] transition-all active:scale-95"
                                        >
                                            Dismiss View
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkingProcess;

