import { memo, useContext, useState, useEffect } from 'react';
import { Menu, ChevronLeft, ChevronRight, LogOut, Armchair, Settings, Palette, Wifi, WifiOff } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ThemeSwitcher from './ThemeSwitcher';

const TopBar = memo(({ onMenuClick, sidebarCollapsed }) => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <header
            className="sticky top-0 z-30 flex flex-col justify-center min-h-[64px] md:h-[68px] border-b border-[var(--theme-border)] flex-shrink-0 pt-safe transition-all"
            style={{ backgroundColor: 'var(--theme-topbar-bg)', backdropFilter: 'blur(12px)' }}
        >
            {/* ── Main row ── */}
            <div className="flex items-center w-full px-2 xs:px-3 md:px-4 gap-1.5 xs:gap-3 h-[54px] md:h-full">
                
                {/* ── Left: Collapse/Menu Toggle ── */}
                <button
                    onClick={onMenuClick}
                    className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-[var(--theme-bg-dark)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] transition-all active:scale-95 shadow-sm group overflow-hidden"
                >
                    <div className="md:hidden">
                        <Menu size={20} strokeWidth={2.5} />
                    </div>
                    <div className="hidden md:flex items-center transition-transform duration-500">
                        {sidebarCollapsed ? (
                            <div className="flex items-center text-rose-500">
                                <ChevronRight size={20} strokeWidth={3} className="animate-chevron-r1" />
                                <ChevronRight size={20} strokeWidth={3} className="-ml-3 opacity-60 animate-chevron-r2" />
                            </div>
                        ) : (
                            <div className="flex items-center text-blue-500">
                                <ChevronLeft size={20} strokeWidth={3} className="animate-chevron-1" />
                                <ChevronLeft size={20} strokeWidth={3} className="-ml-3 opacity-60 animate-chevron-2" />
                            </div>
                        )}
                    </div>
                </button>
 
                {/* ── Center: Portal (Dynamic Page Controls) ── */}
                <div id="topbar-portal" className="flex-1 flex items-center justify-start overflow-hidden min-w-0" />
 
{/* ── Right: Operations & Utilities ── */}
                <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0 ml-auto">
                    
                    {!isOnline && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                            <WifiOff size={14} />
                            <span className="hidden xs:inline">OFFLINE</span>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 sm:gap-2">
  
                        {/* Notifications */}
                        <NotificationBell />
 
                        {/* Admin Shortcuts (Table Map & Settings) */}
                        {user?.role === 'admin' && (
                            <>
                                <button
                                    onClick={() => navigate('/admin/tables')}
                                    title="Table Map"
                                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 text-white hover:bg-blue-500 hover:text-white transition-all duration-200 border border-blue-500/30 active:scale-95 shadow-sm"
                                >
                                    <Armchair size={18} />
                                </button>
                                <button
                                    onClick={() => navigate('/admin/settings')}
                                    title="Settings"
                                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500/10 text-white hover:bg-orange-500 hover:text-white transition-all duration-200 border border-orange-500/30 active:scale-95 shadow-sm"
                                >
                                    <Settings size={18} />
                                </button>
                            </>
                        )}
 
                    </div>
                </div>
            </div>

            {/* ── Mobile/Tablet row 2: page actions injected by pages ── */}
            <div id="topbar-portal-row2" className="flex lg:hidden items-center w-full pb-2 gap-2 px-3 empty:hidden" />
        </header>
    );
});

export default TopBar;
