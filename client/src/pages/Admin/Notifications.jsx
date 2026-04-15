import { useState, useContext, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { NotificationContext } from '../../context/NotificationContext';
import api from '../../api';
const logoImg = '/logo.png';
import {
    Bell, Send, Megaphone, Users, ChefHat, CreditCard,
    ShoppingBag, AlertTriangle, CheckCheck,
    X, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';

// ── Type config ──────────────────────────────────────────────────────────────
const typeConfig = {
    NEW_ORDER: { icon: ShoppingBag, color: 'blue', label: 'New Order' },
    ORDER_READY: { icon: ChefHat, color: 'green', label: 'Order Ready' },
    PAYMENT_SUCCESS: { icon: CreditCard, color: 'emerald', label: 'Payment' },
    ORDER_CANCELLED: { icon: X, color: 'red', label: 'Cancelled' },
    OFFER_ANNOUNCEMENT: { icon: Megaphone, color: 'orange', label: 'Offer' },
    SYSTEM_ALERT: { icon: AlertTriangle, color: 'yellow', label: 'System' },
};

const roleOptions = [
    { id: 'all', label: 'All Staff', icon: Users, desc: 'Every role receives this' },
    { id: 'kitchen', label: 'Kitchen', icon: ChefHat, desc: 'Kitchen display staff' },
    { id: 'waiter', label: 'Waiters', icon: ShoppingBag, desc: 'Serving staff' },
    { id: 'cashier', label: 'Cashiers', icon: CreditCard, desc: 'Billing staff' },
];

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

/* ═══════════════════════════════════════════════════════════════════════════ */
const AdminNotifications = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, deleteNotification } = useContext(NotificationContext);

    // ── Offer form state ─────────────────────────────────────────────────────
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [roleTarget, setRoleTarget] = useState('all');
    const [sending, setSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);
    const [sendError, setSendError] = useState('');
    const [expandedForm, setExpandedForm] = useState(true);

    // ── Send offer ───────────────────────────────────────────────────────────
    const handleSendOffer = async (e) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) return;

        setSending(true);
        setSendError('');
        setSendSuccess(false);

        try {
            await api.post('/api/notifications/offer', {
                title: title.trim(),
                message: message.trim(),
                roleTarget,
            });
            setSendSuccess(true);
            setTitle('');
            setMessage('');
            setRoleTarget('all');

            setTimeout(() => setSendSuccess(false), 3000);
        } catch (err) {
            setSendError(err.response?.data?.message || 'Failed to send notification');
        } finally {
            setSending(false);
        }
    };

    // ── Stats ────────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const offers = notifications.filter(n => n.type === 'OFFER_ANNOUNCEMENT').length;
        return { unread: unreadCount, offers, total: notifications.length };
    }, [notifications, unreadCount]);

    return (
        <div className="space-y-5 animate-fade-in pb-10">
            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--theme-bg-card2)] rounded-2xl p-5 border border-[var(--theme-border)]">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-[var(--theme-bg-deep)] rounded-xl flex items-center justify-center shadow-glow-orange flex-shrink-0 border border-[var(--theme-border)] p-1.5">
                        <img src={logoImg} alt="KAGSZO" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-[var(--theme-text-main)]">
                            Notifications Center
                        </h1>
                        <p className="text-xs text-[var(--theme-text-subtle)] mt-0.5">
                            Real-time alerts & broadcasts
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={clearAll}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
                    >
                        <Trash2 size={15} />
                        <span>Clear All</span>
                    </button>
                    {stats.unread > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-md min-h-[44px]"
                        >
                            <CheckCheck size={15} />
                            <span>Mark All Read ({stats.unread})</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Stats Cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[var(--theme-bg-card)] p-4 rounded-2xl border border-[var(--theme-border)]">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--theme-text-muted)]">Total</p>
                    <p className="text-2xl font-black text-[var(--theme-text-main)] mt-1">{stats.total}</p>
                </div>
                <div className="bg-[var(--theme-bg-card)] p-4 rounded-2xl border border-[var(--theme-border)]">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-red-400">Unread</p>
                    <p className="text-2xl font-black text-red-400 mt-1">{stats.unread}</p>
                </div>
                <div className="bg-[var(--theme-bg-card)] p-4 rounded-2xl border border border-[var(--theme-border)]">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-orange-400">Offers Sent</p>
                    <p className="text-2xl font-black text-orange-400 mt-1">{stats.offers}</p>
                </div>
            </div>

            {/* ── Offer Broadcast Panel ───────────────────────────────── */}
            <div className="bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <button
                    onClick={() => setExpandedForm(!expandedForm)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--theme-bg-hover)] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
                            <Megaphone size={16} className="text-orange-400" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-sm font-bold text-[var(--theme-text-main)]">Send Offer / Announcement</h2>
                            <p className="text-[10px] text-[var(--theme-text-subtle)]">Broadcast to all staff or specific roles</p>
                        </div>
                    </div>
                    {expandedForm ? <ChevronUp size={16} className="text-[var(--theme-text-muted)]" /> : <ChevronDown size={16} className="text-[var(--theme-text-muted)]" />}
                </button>

                {expandedForm && (
                    <form onSubmit={handleSendOffer} className="px-5 pb-5 space-y-4 border-t border-[var(--theme-border)]">
                        {sendSuccess && (
                            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
                                <CheckCheck size={16} className="text-emerald-400" />
                                <p className="text-sm font-bold text-emerald-400">Notification broadcasted!</p>
                            </div>
                        )}
                        {sendError && (
                            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
                                <AlertTriangle size={16} className="text-red-400" />
                                <p className="text-sm font-bold text-red-400">{sendError}</p>
                            </div>
                        )}

                        <div className="mt-4">
                            <label className="block text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wider mb-2">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Happy Hour!"
                                className="w-full px-4 py-3 bg-[var(--theme-bg-hover)] border border-[var(--theme-border)] rounded-xl text-sm"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wider mb-2">Message</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Details..."
                                className="w-full px-4 py-3 bg-[var(--theme-bg-hover)] border border-[var(--theme-border)] rounded-xl text-sm resize-none"
                                rows={3}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wider mb-2">Send To</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {roleOptions.map(opt => {
                                    const Icon = opt.icon;
                                    const isSelected = roleTarget === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setRoleTarget(opt.id)}
                                            className={`p-3 rounded-xl border flex flex-col items-center gap-1 ${isSelected ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-[var(--theme-bg-hover)] border-[var(--theme-border)] text-[var(--theme-text-muted)]'}`}
                                        >
                                            <Icon size={18} />
                                            <span className="text-xs font-bold">{opt.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={sending}
                            className={`w-full py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${sending ? 'bg-gray-500 text-white opacity-50' : 'bg-orange-600 text-white'}`}
                        >
                            {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={16} />}
                            Broadcast
                        </button>
                    </form>
                )}
            </div>

            {/* ── History Panel ───────────────────────────────────────── */}
            <div className="bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--theme-border)]">
                    <h2 className="text-sm font-bold text-[var(--theme-text-main)]">History (Last 24h)</h2>
                </div>
                <div className="divide-y divide-[var(--theme-border)]">
                    {notifications.length === 0 ? (
                        <div className="py-16 text-center text-[var(--theme-text-muted)]">
                            <Bell size={40} className="mx-auto opacity-20 mb-3" />
                            <p className="text-sm font-medium">No recent notifications</p>
                        </div>
                    ) : (
                        notifications.map(notif => {
                            const config = typeConfig[notif.type] || typeConfig.SYSTEM_ALERT;
                            const Icon = config.icon;
                            return (
                                <div key={notif._id} className={`flex items-start gap-4 px-5 py-4 transition-colors group relative ${notif.isRead ? 'opacity-50' : 'bg-orange-500/5'}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${config.color}-500/10 text-${config.color}-400`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <div>
                                                <p className={`text-sm font-bold ${notif.isRead ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-text-main)]'}`}>{notif.title}</p>
                                                <p className="text-xs text-[var(--theme-text-subtle)] mt-1">{notif.message}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                                                <span className="text-[10px] text-[var(--theme-text-subtle)]">{timeAgo(notif.createdAt)}</span>
                                                <div className="flex gap-1">
                                                    {!notif.isRead && (
                                                        <button onClick={() => markAsRead(notif._id)} className="p-1 px-2 bg-emerald-500/10 text-emerald-500 rounded text-[9px] font-bold">READ</button>
                                                    )}
                                                    <button onClick={() => deleteNotification(notif._id)} className="p-1 bg-red-500/10 text-red-500 rounded"><Trash2 size={12}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminNotifications;
