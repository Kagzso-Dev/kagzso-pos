import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LogOut, LayoutDashboard, Monitor, Utensils, ChefHat,
    Layers, Coffee, Settings, ClipboardList, ChevronLeft,
    ChevronRight, X, TrendingUp, Bell, History, XCircle, CheckCircle2, Armchair,
    Package
} from 'lucide-react';
const logoImg = '/logo.png';
import ThemeSwitcher from './ThemeSwitcher';


/**
 * Adaptive Sidebar
 *
 * Props:
 *   collapsed          – boolean (tablet icon-only mode)
 *   onToggleCollapse   – fn to toggle collapsed
 *   onClose            – fn to close drawer on mobile
 */
const Sidebar = ({ collapsed = false, onToggleCollapse, onClose }) => {
    const { user, logout, settings, socketConnected } = useContext(AuthContext);
    const { unreadCount } = useContext(NotificationContext);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    if (!user) return null;

    const isActive = (path) => {
        if (path.includes('?')) return location.pathname + location.search === path;
        return location.pathname === path && !location.search;
    };

    const handleNav = (path) => {
        navigate(path);
        // Close drawer on mobile after navigation
        if (onClose) onClose();
    };

    /* ── NavItem ─────────────────────────────────────────────────────── */
    const NavItem = ({ to, onClick, icon: Icon, label, color = 'text-[var(--theme-text-muted)]', badge }) => {
        const active = to ? isActive(to) : false;
        
        const handleClick = () => {
            if (onClick) {
                onClick();
                if (onClose) onClose();
            } else if (to) {
                handleNav(to);
            }
        };

        return (
            <button
                onClick={handleClick}
                title={collapsed ? label : undefined}
                className={`
                    w-full flex items-center rounded-xl transition-all duration-300 group relative tap-scale overflow-hidden
                    ${collapsed ? 'justify-center px-0 py-3' : 'space-x-3 px-4 py-3'}
                    ${active
                        ? 'bg-gradient-to-r from-orange-500/20 to-orange-600/5 text-[var(--theme-text-main)] font-black shadow-sm'
                        : 'hover:bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:translate-x-1'
                    }
                `}
            >
                {/* Active Indicator Bar - Pure straight bit at the edge of the button */}
                {active && (
                    <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.5)] z-10" />
                )}
                <Icon
                    size={20}
                    className={`flex-shrink-0 transition-all duration-300 ${active ? 'text-white scale-110' : color} group-hover:text-white`}
                />
                {!collapsed && (
                    <span className="font-bold text-[13px] tracking-tight truncate uppercase">{label}</span>
                )}
                {badge && !collapsed && (
                    <span className="ml-auto bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-lg shadow-orange-500/20 animate-pulse-subtle">
                        {badge}
                    </span>
                )}
                {/* Tooltip for collapsed mode */}
                {collapsed && (
                    <span className="
                        absolute left-full ml-3 px-2 py-1 bg-[var(--theme-bg-card)] text-[var(--theme-text-main)] text-xs
                        rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100
                        pointer-events-none transition-opacity shadow-lg border border-[var(--theme-border)]
                        z-50
                    ">
                        {label}
                    </span>
                )}
            </button>
        );
    };

    /* ── Section Label ───────────────────────────────────────────────── */
    const SectionLabel = ({ children }) => !collapsed ? (
        <div className="px-4 pt-8 pb-2 flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-orange-500/40" />
            <span className="text-[9px] font-black text-[var(--theme-text-subtle)] uppercase tracking-[0.2em] opacity-60">
                {children}
            </span>
        </div>
    ) : (
        <div className="my-4 h-px bg-[var(--theme-border)] mx-3" />
    );

    return (
        <div
            className="h-full text-[var(--theme-text-main)] flex flex-col border-r border-[var(--theme-border)] shadow-2xl transition-all duration-300 overflow-hidden"
            style={{ backgroundColor: 'var(--theme-sidebar-bg)' }}
        >

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className={`flex items-center border-b border-[var(--theme-border)] flex-shrink-0 pt-safe relative h-[80px] ${collapsed ? 'justify-center' : 'justify-start px-5'} bg-gradient-to-b from-white/5 to-transparent`}>
                
                {/* Logo & Brand Group - Left Aligned */}
                <div
                    onClick={() => handleNav('/')}
                    className={`flex items-center cursor-pointer group ${collapsed ? '' : 'space-x-3.5'}`}
                >
                    <div className="w-12 h-12 flex-shrink-0 rounded-2xl bg-gradient-to-br from-white to-gray-100 p-2 flex items-center justify-center shadow-xl border border-[var(--theme-border)] group-hover:scale-105 group-hover:rotate-3 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <img src={logoImg} alt="KAGZSO" className="w-full h-full object-contain relative z-10" />
                    </div>

                    {!collapsed && (
                        <div className="flex flex-col justify-center text-left">
                            <span className="text-sm font-black text-orange-500 uppercase leading-tight">KAGZSO</span>
                            <h1 className="text-xs font-black tracking-tight text-[var(--theme-text-main)] truncate leading-tight uppercase flex items-center gap-2">
                                {settings?.restaurantName || 'admin'}
                                {socketConnected && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        <span className="text-[8px] font-black tracking-widest text-emerald-500 uppercase">
                                            LIVE
                                        </span>
                                    </div>
                                )}
                            </h1>
                        </div>
                    )}
                </div>

                {/* Close button – visible only on mobile drawer (<768px) */}
                {!collapsed && onClose && (
                    <button
                        onClick={onClose}
                        className="absolute right-4 md:hidden flex-shrink-0 p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded-lg tap-scale"
                        aria-label="Close menu"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* ── User Profile ────────────────────────────────────────── */}
            {!collapsed && (
                <div className="px-4 py-6 flex-shrink-0">
                    <div className="bg-gradient-to-br from-[var(--theme-bg-muted)] to-[var(--theme-bg-card)] rounded-2xl p-4 border border-[var(--theme-border)] flex items-center space-x-3 shadow-xl backdrop-blur-md relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 rounded-full -mr-8 -mt-8 blur-2xl transition-all group-hover:bg-orange-500/10" />
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-sm font-black flex-shrink-0 ring-2 ring-[var(--theme-bg-dark)] shadow-lg transform group-hover:rotate-6 transition-all duration-300">
                            {user.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-[var(--theme-text-main)] truncate uppercase tracking-tight">{user.username}</p>
                        </div>
                    </div>
                </div>
            )}

            {collapsed && (
                <div className="flex justify-center py-6 flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-sm font-black shadow-xl ring-2 ring-[var(--theme-bg-dark)]">
                        {user.username?.charAt(0).toUpperCase()}
                    </div>
                </div>
            )}

            {/* ── Navigation ──────────────────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-2 pb-10 min-h-0 flex flex-col">

                {/* ADMIN LINKS */}
                {user.role === 'admin' && (
                    <>
                        <SectionLabel>Admin Console</SectionLabel>
                        <NavItem to="/admin" icon={LayoutDashboard} label="Dashboard" />
                        <NavItem to="/admin/orders" icon={ClipboardList} label="Orders History" />
                        <NavItem to="/admin/analytics" icon={TrendingUp} label="Analytics" color="text-emerald-400" />
                        <NavItem to="/admin/notifications" icon={Bell} label="Notifications" color="text-orange-400" badge={unreadCount > 0 ? unreadCount : null} />
                        <NavItem to="/admin/menu" icon={Coffee} label="Menu Items" />
                        <NavItem to="/admin/categories" icon={Layers} label="Categories" />
                        <SectionLabel>Live Views</SectionLabel>
                        <NavItem to="/kitchen" icon={ChefHat} label="Kitchen View" color="text-orange-400" />
                        <NavItem to="/cashier" icon={Monitor} label="Cashier Point" color="text-green-400" />
                        <NavItem to="/waiter" icon={Armchair} label="Waiter Board" color="text-yellow-400" />
                    </>
                )}

                {/* OPERATIONS LINKS */}
                {user.role !== 'admin' && (
                    <>
                        <SectionLabel>Operations</SectionLabel>

                        {user.role === 'kitchen' && (
                            <>
                                <NavItem to="/kitchen?tab=active" icon={ChefHat} label="Active KOTs" color="text-orange-400" />
                            </>
                        )}

                        {user.role === 'cashier' && (
                            <>
                                <NavItem to="/cashier" icon={Monitor} label="Cashier Point" color="text-green-400" />
                                <NavItem to="/waiter" icon={Armchair} label="Order View" color="text-yellow-400" />
                                <NavItem to="/kitchen" icon={ChefHat} label="Kitchen View" color="text-orange-400" />
                            </>
                        )}

                        {user.role === 'waiter' && (
                            <>
                                <NavItem to="/waiter" icon={LayoutDashboard} label="Waiter Dashboard" color="text-pink-400" />
                                <NavItem to="/kitchen" icon={ChefHat} label="Kitchen View" color="text-emerald-400" />
                                <NavItem to="/waiter/history" icon={History} label="Order History" color="text-purple-400" />
                            </>
                        )}
                    </>
                )}

                {/* Theme Selector - Bottom of Nav */}
                <div className={`mt-auto pt-4 border-t border-[var(--theme-border)] ${collapsed ? 'px-0' : 'px-2'}`}>
                     <ThemeSwitcher collapsed={collapsed} />
                </div>

                {/* RELOCATED: Logout button - Always visible for all devices and roles */}
                <div className="mt-2 mb-2 px-1">
                    <NavItem 
                        onClick={handleLogout} 
                        icon={LogOut} 
                        label="Sign Out" 
                        color="text-rose-500" 
                    />
                </div>
            </nav>

        </div>
    );
};

export default Sidebar;
