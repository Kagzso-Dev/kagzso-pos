import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import { Bell, Check, CheckCheck, Volume2, VolumeX, Megaphone, ShoppingBag, CreditCard, ChefHat, AlertTriangle, X, Trash2, ArrowRight } from 'lucide-react';

// ── Notification type metadata ───────────────────────────────────────────────
const typeConfig = {
    NEW_ORDER: { icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'New Order' },
    order: { icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'New Order' },
    ORDER_READY: { icon: ChefHat, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', label: 'Order Ready' },
    ready: { icon: ChefHat, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', label: 'Order Ready' },
    PAYMENT_SUCCESS: { icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Payment' },
    payment: { icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Payment' },
    ORDER_CANCELLED: { icon: X, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Cancelled' },
    OFFER_ANNOUNCEMENT: { icon: Megaphone, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'Offer' },
    SYSTEM_ALERT: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'System' },
    WAITER_REQUEST: { icon: Bell, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'Staff Request' },
};

// ── Sound alert types per role ───────────────────────────────────────────────
const SOUND_TRIGGERS = {
    kitchen: ['NEW_ORDER'],
    cashier: ['PAYMENT_SUCCESS'],
    waiter: ['WAITER_REQUEST', 'ORDER_READY', 'NEW_ORDER'],
};

// ── Time-ago helper ──────────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
    const minutes = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (minutes === null || minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (days < 30) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
};

// ── Notification Row (shared between dropdown & full panel) ──────────────────
const NotifRow = ({ notif, onRead, onDelete, showDelete = false }) => {
    const config = typeConfig[notif.type] || typeConfig.SYSTEM_ALERT;
    const Icon = config.icon;
    return (
        <div
            className={`flex items-start gap-3 px-4 py-3 group hover:bg-[var(--theme-bg-hover)] transition-colors ${notif.isRead ? 'opacity-50' : ''}`}
            onClick={() => !notif.isRead && onRead(notif._id)}
        >
            <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border ${config.bg} ${config.border} ${config.color}`}>
                <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0 cursor-pointer">
                <div className="flex justify-between items-start gap-2">
                    <p className={`text-xs font-bold truncate ${notif.isRead ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-text-main)]'}`}>{notif.title}</p>
                    <span className="text-[10px] text-[var(--theme-text-subtle)] shrink-0">{timeAgo(notif.createdAt)}</span>
                </div>
                <p className="text-[11px] text-[var(--theme-text-subtle)] mt-0.5 line-clamp-2">{notif.message}</p>
                <span className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${config.bg} ${config.color}`}>{config.label}</span>
            </div>
            {showDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(notif._id); }}
                    className="shrink-0 p-1.5 rounded-lg text-[var(--theme-text-subtle)] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                    <Trash2 size={13} />
                </button>
            )}
        </div>
    );
};

// ── Full Notifications Panel (portal) ────────────────────────────────────────
const NotificationsPanel = ({ onClose }) => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, deleteNotification } = useContext(NotificationContext);
    const [filter, setFilter] = useState('all');

    const filtered = notifications.filter(n => {
        if (filter === 'unread') return !n.isRead;
        return true;
    });

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative ml-auto w-full max-w-md h-full bg-[var(--theme-bg-card)] border-l border-[var(--theme-border)] shadow-2xl flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg-hover)] shrink-0">
                    <div className="flex items-center gap-2">
                        <Bell size={18} className="text-orange-400" />
                        <h2 className="font-bold text-base">All Notifications</h2>
                        {unreadCount > 0 && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full">{unreadCount}</span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]">
                        <X size={18} />
                    </button>
                </div>

                {/* Actions bar */}
                <div className="flex items-center justify-between px-5 py-2 border-b border-[var(--theme-border)] shrink-0">
                    {/* Filter tabs */}
                    <div className="flex gap-1">
                        {['all', 'unread'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1 text-[11px] font-bold rounded-lg capitalize transition-colors ${filter === f ? 'bg-orange-500/15 text-orange-400' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                            <button onClick={markAllAsRead} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-orange-400 hover:bg-orange-500/10 rounded-lg">
                                <CheckCheck size={12} /> Read All
                            </button>
                        )}
                        {notifications.length > 0 && (
                            <button onClick={clearAll} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/10 rounded-lg">
                                <Trash2 size={12} /> Clear All
                            </button>
                        )}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto divide-y divide-[var(--theme-border)]">
                    {filtered.length === 0 ? (
                        <div className="py-20 text-center text-[var(--theme-text-muted)] opacity-60">
                            <Bell size={40} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-medium">{filter === 'unread' ? 'No unread notifications' : 'No notifications'}</p>
                        </div>
                    ) : (
                        filtered.map(notif => (
                            <NotifRow
                                key={notif._id}
                                notif={notif}
                                onRead={markAsRead}
                                onDelete={deleteNotification}
                                showDelete
                            />
                        ))
                    )}
                </div>

                {/* Footer count */}
                {filtered.length > 0 && (
                    <div className="px-5 py-3 border-t border-[var(--theme-border)] shrink-0 text-center text-[10px] text-[var(--theme-text-subtle)]">
                        {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

const NotificationBell = () => {
    useContext(AuthContext);
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useContext(NotificationContext);
    const [isOpen, setIsOpen] = useState(false);
    const [showPanel, setShowPanel] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(() => {
        try { return localStorage.getItem('notif_sound') !== 'off'; } catch { return true; }
    });
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Close dropdown when panel opens
    const openPanel = () => { setIsOpen(false); setShowPanel(true); };

    const toggleSound = () => {
        const next = !soundEnabled;
        setSoundEnabled(next);
        try { localStorage.setItem('notif_sound', next ? 'on' : 'off'); } catch { }
    };

    return (
        <>
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${isOpen ? 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] bg-[var(--theme-bg-hover)]' }`}
            >
                <Bell size={19} className={unreadCount > 0 ? 'animate-bounce' : ''} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full ring-2 ring-[var(--theme-bg-dark)] animate-scale-in">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="fixed inset-x-4 top-20 sm:absolute sm:top-full sm:right-0 sm:inset-x-auto sm:mt-2 w-auto sm:w-[380px] bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl shadow-2xl z-[100] animate-fade-in overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-bg-hover)]">
                        <div className="flex items-center gap-2">
                            <Bell size={16} className="text-orange-400" />
                            <h3 className="text-sm font-bold">Notifications</h3>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={toggleSound} className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]">
                                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                            </button>
                            {unreadCount > 0 && (
                                <button onClick={markAllAsRead} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-orange-400">
                                    <CheckCheck size={12} /> Read All
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="max-h-[340px] overflow-y-auto divide-y divide-[var(--theme-border)]">
                        {notifications.length === 0 ? (
                            <div className="py-12 text-center text-[var(--theme-text-muted)] opacity-60">
                                <Bell size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm font-medium">No notifications</p>
                            </div>
                        ) : (
                            notifications.slice(0, 5).map(notif => (
                                <NotifRow key={notif._id} notif={notif} onRead={markAsRead} />
                            ))
                        )}
                    </div>

                    {/* View All footer */}
                    <button
                        onClick={openPanel}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold text-orange-400 hover:bg-orange-500/10 border-t border-[var(--theme-border)] transition-colors"
                    >
                        View All Notifications <ArrowRight size={12} />
                    </button>
                </div>
            )}
        </div>

        {showPanel && <NotificationsPanel onClose={() => setShowPanel(false)} />}
        </>
    );
};

export default NotificationBell;
