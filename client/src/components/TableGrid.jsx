import { useContext, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { CalendarPlus, X, ChevronDown, Pencil, Check } from 'lucide-react';
import TableCard, { STATUS_CONFIG } from './TableCard';
import { useTablesData } from '../hooks/useTablesData';

// ── Zone storage helpers (localStorage) ──────────────────────────────────────
const ZONE_KEY = 'kagzso_table_zones';
const loadZones = () => { try { return JSON.parse(localStorage.getItem(ZONE_KEY) || '{}'); } catch { return {}; } };
const saveZones = (z) => { try { localStorage.setItem(ZONE_KEY, JSON.stringify(z)); } catch { } };

const TableGrid = ({
    onSelectTable,
    allowedStatuses = ['available', 'occupied', 'cleaning'],
    filterByAllowedStatuses = false,
    showCleanAction = false,
    onReserve,
    onCancelReservation,
}) => {
    const { tables, setTables } = useTablesData();
    const { user } = useContext(AuthContext);

    // ── Sidebar collapse state ─────────────────────────────────────────────────
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

    useEffect(() => {
        const handler = (e) => setSidebarCollapsed(e.detail?.collapsed ?? true);
        window.addEventListener('sidebar-toggle', handler);
        return () => window.removeEventListener('sidebar-toggle', handler);
    }, []);

    // ── Zone state ────────────────────────────────────────────────────────────
    const [zones, setZones] = useState(loadZones);          // { tableId: zoneName }
    const [activeZoneTab, setActiveZoneTab] = useState('All tables');
    const [statusFilter, setStatusFilter] = useState('all');
    const [filterOpen, setFilterOpen] = useState(false);
    const [editingZone, setEditingZone] = useState(null);   // tableId being reassigned
    const [zoneInput, setZoneInput] = useState('');
    const filterRef = useRef(null);

    // ── Derive zone names ─────────────────────────────────────────────────────
    const zoneNames = useMemo(() => {
        const names = new Set(Object.values(zones));
        return ['All tables', ...Array.from(names).sort()];
    }, [zones]);

    // ── Filtered tables ───────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        return tables.filter(t => {
            const inZone = activeZoneTab === 'All tables' || (zones[t._id] || 'Other') === activeZoneTab;
            const inStatus = statusFilter === 'all' || t.status === statusFilter;
            const isAllowed = !filterByAllowedStatuses || allowedStatuses.includes(t.status);
            return inZone && inStatus && isAllowed;
        });
    }, [tables, zones, activeZoneTab, statusFilter, filterByAllowedStatuses, allowedStatuses]);

    // ── Tables grouped by zone ────────────────────────────────────────────────
    const grouped = useMemo(() => {
        const map = {};
        filtered.forEach(t => {
            const z = zones[t._id] || 'Other';
            if (!map[z]) map[z] = [];
            map[z].push(t);
        });
        // Sort zone keys alphabetically
        return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
    }, [filtered, zones]);

    // ── Zone assignment ───────────────────────────────────────────────────────
    const assignZone = useCallback((tableId, zoneName) => {
        const trimmed = zoneName.trim();
        setZones(prev => {
            const next = { ...prev };
            if (!trimmed || trimmed === 'Other') {
                delete next[tableId];
            } else {
                next[tableId] = trimmed;
            }
            saveZones(next);
            return next;
        });
        setEditingZone(null);
        setZoneInput('');
    }, []);

    // ── Table action handlers ─────────────────────────────────────────────────
    const handleTableClick = useCallback((table) => {
        if (allowedStatuses.includes(table.status)) onSelectTable?.(table);
    }, [allowedStatuses, onSelectTable]);

    const handleCleanTable = useCallback(async (e, table) => {
        e.stopPropagation();
        try {
            await api.put(`/api/tables/${table._id}/clean`, {}, { headers: { Authorization: `Bearer ${user.token}` } });
            setTables(prev => prev.map(t => t._id === table._id ? { ...t, status: 'available', lockedBy: null } : t));
        } catch (err) { alert(err.response?.data?.message || 'Failed to mark table as clean'); }
    }, [user, setTables]);

    const handleReserveClick = useCallback(async (e, table) => {
        e.stopPropagation();
        if (onReserve) { onReserve(table._id); return; }
        try {
            const res = await api.put(`/api/tables/${table._id}/reserve`, {}, { headers: { Authorization: `Bearer ${user.token}` } });
            setTables(prev => prev.map(t => t._id === table._id ? res.data : t));
        } catch (err) { alert(err.response?.data?.message || 'Failed to reserve'); }
    }, [user, onReserve, setTables]);

    const handleCancelReservation = useCallback(async (e, table) => {
        e.stopPropagation();
        if (onCancelReservation) { onCancelReservation(table._id); return; }
        try {
            const res = await api.put(`/api/tables/${table._id}/release`, {}, { headers: { Authorization: `Bearer ${user.token}` } });
            setTables(prev => prev.map(t => t._id === table._id ? res.data : t));
        } catch (err) { alert(err.response?.data?.message || 'Failed to release'); }
    }, [user, onCancelReservation, setTables]);

    const isClickable = (table) => {
        if (table.status === 'available') return true;
        if (showCleanAction && table.status === 'cleaning') return true;
        return allowedStatuses.includes(table.status);
    };

    const getActions = (table) => {
        return null;
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="font-sans">
            {/* ── Top bar: Zone tabs + Filter dropdown ──────────────────────── */}
            <div className="flex items-center justify-between border-b border-gray-200 mb-5">
                {/* Zone tabs */}
                <div className="flex items-center gap-0 overflow-x-auto no-scrollbar">
                    {zoneNames.map(z => (
                        <button
                            key={z}
                            onClick={() => setActiveZoneTab(z)}
                            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-150 ${
                                activeZoneTab === z
                                    ? 'border-red-500 text-red-500'
                                    : 'border-transparent text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            {z}
                        </button>
                    ))}
                </div>

                {/* Filter By dropdown */}
                <div className="relative shrink-0 ml-4" ref={filterRef}>
                    <button
                        onClick={() => setFilterOpen(o => !o)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <span className="text-xs text-gray-400 font-semibold">Filter By</span>
                        <span className="text-gray-800 font-semibold capitalize">
                            {statusFilter === 'all' ? 'All Tables' : STATUS_CONFIG[statusFilter]?.label}
                        </span>
                        <ChevronDown size={14} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {filterOpen && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                            {['all', ...Object.keys(STATUS_CONFIG)].map(s => (
                                <button
                                    key={s}
                                    onClick={() => { setStatusFilter(s); setFilterOpen(false); }}
                                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${statusFilter === s ? 'bg-red-50 text-red-600' : 'text-gray-700 hover:bg-gray-50'}`}
                                >
                                    {s === 'all' ? 'All Tables' : STATUS_CONFIG[s]?.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Table groups ──────────────────────────────────────────────── */}
            {Object.keys(grouped).length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                    <p className="text-sm font-medium">No tables found</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(grouped).map(([zoneName, zoneTables]) => (
                        <div key={zoneName}>
                            {/* Zone heading */}
                            <p className="text-sm font-semibold text-gray-700 mb-3">{zoneName}</p>

                            {/* Table cards row: Responsive Grid — Now 2 columns on Mobile */}
                            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${sidebarCollapsed ? 'lg:grid-cols-6 xl:grid-cols-7' : 'lg:grid-cols-5 xl:grid-cols-6'} gap-3`}>
                                {zoneTables.map(table => {
                                    const clickable = isClickable(table);
                                    return (
                                        <div key={table._id} className="flex flex-col gap-1.5 relative group/zone">
                                            <TableCard
                                                table={table}
                                                variant="grid"
                                                clickable={clickable}
                                                onClick={() => clickable && handleTableClick(table)}
                                                actions={getActions(table)}
                                            />

                                            {/* Mark Clean */}
                                            {showCleanAction && table.status === 'cleaning' && (
                                                <button 
                                                    onClick={(e) => handleCleanTable(e, table)}
                                                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] text-white text-base font-bold uppercase rounded-xl transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
                                                >
                                                    <Check size={18} strokeWidth={4} />
                                                    Clean
                                                </button>
                                            )}

                                            {/* Zone assign button (admin) */}
                                            {user?.role === 'admin' && (
                                                editingZone === table._id ? (
                                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            autoFocus
                                                            value={zoneInput}
                                                            onChange={e => setZoneInput(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') assignZone(table._id, zoneInput); if (e.key === 'Escape') { setEditingZone(null); setZoneInput(''); } }}
                                                            placeholder="Zone name"
                                                            className="flex-1 text-[9px] border border-gray-300 rounded px-1.5 py-1 outline-none focus:border-red-400 w-[55px]"
                                                        />
                                                        <button onClick={() => assignZone(table._id, zoneInput)} className="w-5 h-5 flex items-center justify-center bg-emerald-500 text-white rounded">
                                                            <Check size={10} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setEditingZone(table._id); setZoneInput(zones[table._id] || ''); }}
                                                        className="opacity-0 group-hover/zone:opacity-100 flex items-center gap-0.5 text-[9px] text-gray-400 hover:text-red-500 transition-all font-medium"
                                                    >
                                                        <Pencil size={9} /> {zones[table._id] ? 'Zone' : 'Set zone'}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Click-outside to close filter */}
            {filterOpen && <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />}
        </div>
    );
};

export default TableGrid;
