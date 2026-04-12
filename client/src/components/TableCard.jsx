import { Users, Clock, Lock, Sparkles, Armchair } from 'lucide-react';

// ── Status config ─────────────────────────────────────────────────────────────
export const STATUS_CONFIG = {
    available: {
        bg: 'bg-white',
        border: 'border-emerald-200',
        dot: 'bg-emerald-400',
        text: 'text-emerald-500',
        label: 'Available',
        icon: Sparkles,
        chairColor: 'text-emerald-500',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        hoverBg: 'hover:border-emerald-400 hover:shadow-emerald-100',
        ring: 'ring-emerald-400/30',
    },
    reserved: {
        bg: 'bg-white',
        border: 'border-amber-200',
        dot: 'bg-amber-400',
        text: 'text-amber-500',
        label: 'Reserved',
        icon: Lock,
        chairColor: 'text-amber-500',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        hoverBg: 'hover:border-amber-400 hover:shadow-amber-100',
        ring: 'ring-amber-400/30',
    },
    occupied: {
        bg: 'bg-white',
        border: 'border-rose-200',
        dot: 'bg-rose-400',
        text: 'text-rose-500',
        label: 'Occupied',
        icon: Users,
        chairColor: 'text-rose-500',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
        hoverBg: 'hover:border-rose-400 hover:shadow-rose-100',
        ring: 'ring-rose-400/30',
    },
    cleaning: {
        bg: 'bg-white',
        border: 'border-yellow-300',
        dot: 'bg-yellow-400',
        text: 'text-yellow-500',
        label: 'Cleaning',
        icon: Clock,
        chairColor: 'text-yellow-400',
        badgeBg: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        hoverBg: 'hover:border-yellow-400 hover:shadow-yellow-100',
        ring: 'ring-yellow-400/30',
    },
};

// ── TableCard ─────────────────────────────────────────────────────────────────
const TableCard = ({ table, onClick, clickable = false, actions, variant = 'grid' }) => {
    const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;

    if (variant === 'list') {
        return (
            <div
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? onClick : undefined}
                onKeyDown={clickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
                className={`relative flex items-center justify-between gap-4 px-4 py-3 rounded-xl border ${cfg.border} ${cfg.bg} transition-all duration-150 group
                    ${clickable ? `cursor-pointer hover:shadow-md ${cfg.hoverBg}` : 'cursor-default'}`}
            >
                <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot} ${table.status === 'reserved' ? 'animate-pulse' : ''}`} />
                    <span className="text-sm font-black text-gray-800">{table.number}</span>
                    <span className={`flex items-center gap-1 text-xs font-bold ${cfg.chairColor}`}>
                        <Users size={13} /> {table.capacity}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${cfg.badgeBg}`}>
                        {cfg.label}
                    </span>
                    {actions && <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">{actions}</div>}
                </div>
            </div>
        );
    }

    // ── Grid card — Matches premium squircle style from user screenshot (Compact) ────────
    return (
        <div
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? onClick : undefined}
            onKeyDown={clickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
            className={`
                relative flex flex-col items-center justify-center
                w-full py-4 px-1 sm:max-w-[130px] rounded-[1.75rem] border-2 ${cfg.border} ${cfg.bg}
                shadow-sm transition-all duration-300 group select-none
                ${clickable ? `cursor-pointer hover:shadow-xl hover:-translate-y-1 active:scale-95 ${cfg.hoverBg}` : 'cursor-default'}
            `}
        >
            {/* Table Label */}
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.1em] mb-0.5 opacity-70">
                Table
            </p>

            {/* Table Number */}
            <h3 className={`text-3xl sm:text-4xl font-black leading-none tracking-tighter ${cfg.text} transition-transform duration-300 group-hover:scale-110`}>
                {table.number}
            </h3>

            {/* Status Label */}
            <p className={`text-[9px] font-black uppercase tracking-[0.05em] mt-1 mb-0.5 ${cfg.text}`}>
                {cfg.label}
            </p>

            {/* Capacity Icon/Number */}
            <div className="mt-0.5 flex items-center gap-1 text-gray-400 opacity-70">
                <Users size={11} strokeWidth={3} />
                <span className="text-[10px] font-black tabular-nums">{table.capacity}</span>
            </div>


            {/* Floating Status Dot (Reserved) */}
            {table.status === 'reserved' && (
                <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-amber-400 animate-ping opacity-75" />
            )}

            {/* Actions (hover) */}
            {actions && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-150 z-10 flex flex-col gap-1 translate-x-1 group-hover:translate-x-0">
                    {actions}
                </div>
            )}
        </div>
    );
};

export default TableCard;
