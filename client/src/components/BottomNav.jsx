import { memo, useContext, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
    LayoutDashboard, Utensils, ChefHat, Monitor,
    ClipboardList, Settings, Package, Grid,
    ChevronUp, ChevronDown
} from 'lucide-react';

/**
 * Mobile-only Bottom Navigation Bar
 * Collapsible logic: hidden by default, toggled via a small chevron handle.
 */
const BottomNav = memo(() => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    
    // Default to closed as requested: "default this off"
    const [isOpen, setIsOpen] = useState(false);

    if (!user) return null;

    const isActive = (path) => location.pathname === path;

    const navItems = useMemo(() => {
        if (user.role === 'admin') return [
            { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
            { to: '/admin/orders', icon: ClipboardList, label: 'Orders' },
            { to: '/admin/tables', icon: Monitor, label: 'Tables' },
            { to: '/admin/menu', icon: Utensils, label: 'Menu' },
            { to: '/admin/settings', icon: Settings, label: 'Settings' },
        ];
        if (user.role === 'kitchen') return [
            { to: '/kitchen', icon: ChefHat, label: 'Kitchen' },
        ];
        if (user.role === 'cashier') return [
            { to: '/cashier', icon: Monitor, label: 'POS' },
            { to: '/cashier/working-process', icon: ClipboardList, label: 'Orders' },
            { to: '/waiter', icon: Grid, label: 'Tokens' },
        ];
        if (user.role === 'waiter') return [
            { to: '/waiter', icon: LayoutDashboard, label: 'Dashboard' },
            { to: '/dine-in', icon: Utensils, label: 'Dine In' },
            { to: '/take-away', icon: Package, label: 'Take Away' },
        ];
        return [];
    }, [user.role]);

    return (
        <div className="md:hidden">
            {/* ── Toggle Handle Button (The "One Arrow") ──── */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    fixed left-1/2 -translate-x-1/2 z-[60]
                    flex items-center justify-center
                    w-14 h-10 rounded-t-2xl
                    bg-orange-500 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)]
                    transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
                    ${isOpen ? 'bottom-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom,16px))]' : 'bottom-0'}
                    hover:bg-orange-600 active:scale-95
                `}
                aria-label={isOpen ? "Close Navigation" : "Open Navigation"}
            >
                {isOpen ? (
                    <ChevronDown size={24} strokeWidth={3} className="animate-bounce-slow" />
                ) : (
                    <ChevronUp size={24} strokeWidth={3} className="animate-bounce-slow" />
                )}
            </button>

            {/* ── Navigation Bar ──── */}
            <nav className={`
                fixed bottom-0 left-0 right-0 z-50
                mobile-nav-glass flex items-stretch
                bottom-nav-safe shadow-[0_-8px_30px_rgba(0,0,0,0.2)]
                transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1)
                ${isOpen ? 'translate-y-0' : 'translate-y-full'}
            `}>
                {navItems.map(({ to, icon: Icon, label }) => {
                    const active = isActive(to);
                    return (
                        <button
                            key={to}
                            onClick={() => {
                                navigate(to);
                                if (to !== location.pathname) setIsOpen(false);
                            }}
                            className={`
                                flex-1 flex flex-col items-center justify-center
                                py-2 gap-1 min-h-[56px] transition-all duration-200 tap-scale
                                ${active
                                    ? 'text-orange-500'
                                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]'
                                }
                            `}
                        >
                            {active && (
                                <span className="absolute top-0 h-1 w-12 bg-orange-500 rounded-full" style={{ left: '50%', transform: 'translateX(-50%)' }} />
                            )}
                            <Icon
                                size={22}
                                strokeWidth={active ? 3 : 2}
                                className={active ? 'scale-110 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]' : ''}
                            />
                            <span className={`text-[10px] font-black uppercase tracking-wider ${active ? 'text-orange-500' : 'opacity-60'}`}>
                                {label}
                            </span>
                        </button>
                    );
                })}
            </nav>
            
            {/* Backdrop to close when open */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/5 animate-fade-in" 
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
});

export default BottomNav;
