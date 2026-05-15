import { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const THEME_META = {
    default: { swatches: ['#0f172a', '#1e3a5f', '#f97316'], desc: 'Blue-black premium' },
    dark:    { swatches: ['#000000', '#111827', '#f97316'], desc: 'True black, max contrast' },
    light:   { swatches: ['#f3f4f6', '#ffffff', '#f97316'], desc: 'Clean white, easy on eyes' },
};

const ThemeSwitcher = ({ collapsed = false, isNav = false }) => {
    const { theme: currentTheme, setTheme, themes: THEMES } = useTheme();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const handleThemeChange = (id) => { setTheme(id); setOpen(false); };

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    const current = THEMES.find(t => t.id === currentTheme);
    const currentMeta = THEME_META[currentTheme] || THEME_META.default;

    return (
        <div ref={ref} className="relative flex-shrink-0">

            {/* ── Trigger ── */}
            <button
                onClick={() => setOpen(o => !o)}
                title={(collapsed || isNav) ? `Theme: ${current?.label}` : undefined}
                aria-label="Switch theme"
                className={`
                    flex items-center gap-2.5 rounded-xl transition-all duration-200
                    border text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]
                    ${open
                        ? 'bg-[var(--theme-bg-hover)] border-orange-500/50 shadow-lg shadow-orange-500/10 text-[var(--theme-text-main)]'
                        : 'border-[var(--theme-border)] hover:bg-[var(--theme-bg-hover)]'
                    }
                    ${(collapsed || isNav) ? 'w-8 h-8 justify-center p-0' : 'w-full px-2.5 py-1.5 min-h-[34px]'}
                `}
            >
                {/* Stacked colour dots */}
                <div className="flex -space-x-1 flex-shrink-0">
                    {currentMeta.swatches.map((color, i) => (
                        <span
                            key={i}
                            className="w-2.5 h-2.5 rounded-full border border-[var(--theme-bg-card)] shadow-sm"
                            style={{ backgroundColor: color, zIndex: 3 - i }}
                        />
                    ))}
                </div>
                {!collapsed && !isNav && (
                    <span className="font-bold text-[11px] flex-1 text-left tracking-wide uppercase truncate">
                        {current?.label}
                    </span>
                )}
            </button>

            {/* ── Dropdown ── */}
            {open && (
                <div
                    className={`
                        absolute w-52 z-[200]
                        bg-[var(--theme-bg-card)] border border-[var(--theme-border)]
                        rounded-2xl shadow-2xl shadow-black/50 overflow-hidden
                        ${collapsed
                            ? 'left-full ml-3 bottom-0'
                            : isNav
                                ? 'right-0 top-full mt-2'
                                : 'bottom-full left-0 mb-2'
                        }
                    `}
                    style={{ animation: 'themePop 0.18s cubic-bezier(0.34,1.56,0.64,1) both' }}
                >
                    {/* Header */}
                    <div className="px-3 py-2 border-b border-[var(--theme-border)] flex items-center gap-1.5 flex-shrink-0">
                        <div className="w-1 h-1 rounded-full bg-orange-500" />
                        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">
                            Appearance
                        </span>
                    </div>

                    {/* Scrollable list */}
                    <div className="p-1.5 space-y-0.5 max-h-44 overflow-y-auto custom-scrollbar">
                        {THEMES.map(t => {
                            const active = t.id === currentTheme;
                            const meta = THEME_META[t.id] || THEME_META.default;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => handleThemeChange(t.id)}
                                    className={`
                                        w-full flex items-center gap-2 px-2 py-1.5 rounded-lg
                                        transition-all duration-150 text-left group
                                        ${active
                                            ? 'bg-orange-500/10 border border-orange-500/25'
                                            : 'hover:bg-[var(--theme-bg-hover)] border border-transparent'
                                        }
                                    `}
                                    aria-pressed={active}
                                >
                                    {/* 2×2 swatch tile */}
                                    <div className="flex-shrink-0 w-7 h-7 rounded-lg overflow-hidden border border-[var(--theme-border)] grid grid-cols-2 grid-rows-2">
                                        <span className="col-span-2" style={{ backgroundColor: meta.swatches[0] }} />
                                        <span style={{ backgroundColor: meta.swatches[1] }} />
                                        <span style={{ backgroundColor: meta.swatches[2] }} />
                                    </div>

                                    {/* Label + desc */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[11px] font-bold leading-tight ${active ? 'text-orange-400' : 'text-[var(--theme-text-main)]'}`}>
                                            {t.label}
                                        </p>
                                        <p className="text-[9px] text-[var(--theme-text-muted)] opacity-70 truncate">
                                            {meta.desc}
                                        </p>
                                    </div>

                                    {/* Active check / idle ring */}
                                    {active
                                        ? <Check size={11} className="flex-shrink-0 text-orange-400" />
                                        : <div className="w-2.5 h-2.5 rounded-full border border-[var(--theme-border)] flex-shrink-0 group-hover:border-orange-500/40 transition-colors" />
                                    }
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes themePop {
                    from { opacity: 0; transform: scale(0.92) translateY(6px); }
                    to   { opacity: 1; transform: scale(1)    translateY(0);   }
                }
            `}</style>
        </div>
    );
};

export default ThemeSwitcher;
