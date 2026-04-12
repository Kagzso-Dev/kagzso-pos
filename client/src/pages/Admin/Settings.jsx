import { useState, useEffect, useContext } from 'react';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { queueAction } from '../../utils/syncEngine';
import { saveSetting } from '../../db/db';
import {
    Save, Lock, CheckCircle2, AlertCircle,
    QrCode, Upload, Camera, Loader2, Eye, EyeOff,
    LayoutGrid, Grid, List, Palette, Building2, Shield, Grid2X2,
    Tag, ToggleLeft, ToggleRight
} from 'lucide-react';

/* ── QR Upload Card ────────────────────────────────────────────────────────── */
const QrCard = ({ label, currentUrl, type, token, onUploaded, isSecondary }) => {
    const [preview, setPreview] = useState(currentUrl || null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [localMsg, setLocalMsg] = useState(null);

    useEffect(() => { setPreview(currentUrl || null); }, [currentUrl]);

    const handleFile = (file) => {
        if (!file) return;
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setUploading(true);
        setLocalMsg(null);
        try {
            const formData = new FormData();
            formData.append('type', type);
            formData.append('qr', selectedFile);
            const res = await api.post('/api/settings/qr', formData, {
                headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
            });
            setLocalMsg({ ok: true, text: 'Updated!' });
            onUploaded(res.data);
            setSelectedFile(null);
        } catch (err) {
            setLocalMsg({ ok: false, text: err.response?.data?.message || 'Failed' });
        }
        setUploading(false);
    };

    const galleryId = `gallery-${type}`;
    const cameraId = `camera-${type}`;

    return (
        <div className="flex flex-col gap-3 bg-[var(--theme-bg-muted)] border border-[var(--theme-border)] rounded-xl p-4">
            <p className="text-xs font-semibold text-[var(--theme-text-muted)]">{label}</p>

            <div className="flex items-center justify-center bg-white rounded-lg overflow-hidden h-36 border border-[var(--theme-border)]">
                {preview
                    ? <img src={preview} alt="QR" className="h-full w-full object-contain p-3" />
                    : <div className="flex flex-col items-center gap-2 text-gray-300">
                        <QrCode size={40} strokeWidth={1.5} />
                        <p className="text-xs text-gray-400">No QR uploaded</p>
                    </div>
                }
            </div>

            <div className={`grid gap-2 ${isSecondary ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <label htmlFor={galleryId} className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-violet-50 hover:bg-violet-100 dark:bg-violet-600/10 dark:hover:bg-violet-600/20 border border-violet-200 dark:border-violet-500/20 text-violet-600 dark:text-violet-400 text-xs font-medium cursor-pointer transition-colors">
                    <Upload size={13} /> Gallery
                </label>
                <input id={galleryId} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                {isSecondary && (
                    <>
                        <label htmlFor={cameraId} className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium cursor-pointer transition-colors">
                            <Camera size={13} /> Camera
                        </label>
                        <input id={cameraId} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
                    </>
                )}
            </div>

            {selectedFile && (
                <button type="button" onClick={handleUpload} disabled={uploading}
                    className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {uploading ? 'Uploading...' : 'Save QR'}
                </button>
            )}
            {localMsg && !selectedFile && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${localMsg.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                    {localMsg.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    {localMsg.text}
                </div>
            )}
        </div>
    );
};

/* ── Section Header ────────────────────────────────────────────────────────── */
const SectionHeader = ({ icon: Icon, title, color = 'blue' }) => {
    const colors = {
        blue: 'text-blue-500',
        violet: 'text-violet-500',
        emerald: 'text-emerald-500',
        orange: 'text-orange-500',
        rose: 'text-rose-500',
    };
    return (
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--theme-border)]">
            <Icon size={17} className={colors[color]} />
            <h3 className="text-sm font-semibold text-[var(--theme-text-main)]">{title}</h3>
        </div>
    );
};

/* ── Field ─────────────────────────────────────────────────────────────────── */
const Field = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--theme-text-muted)]">{label}</label>
        {children}
    </div>
);

const inputCls = "w-full h-11 bg-[var(--theme-bg-dark)] border border-[var(--theme-border)] rounded-lg px-3.5 text-sm text-[var(--theme-text-main)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all";

/* ── Notice ────────────────────────────────────────────────────────────────── */
const Notice = ({ msg }) => {
    if (!msg) return null;
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${msg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'}`}>
            {msg.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {msg.text}
        </div>
    );
};

const SaveBtn = ({ loading, label = 'Save Changes', color = 'blue' }) => {
    const bg = {
        blue: 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20',
        emerald: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20',
        orange: 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/20',
        rose: 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20',
    };
    return (
        <button type="submit" disabled={loading}
            className={`h-10 px-6 ${bg[color]} text-white text-xs font-semibold rounded-lg transition-colors shadow-lg disabled:opacity-50 flex items-center gap-2`}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {label}
        </button>
    );
};

const Card = ({ children }) => (
    <section className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] overflow-hidden shadow-sm">
        {children}
    </section>
);

const Footer = ({ section, color, label, msgs, loading }) => (
    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-5 mt-5 border-t border-[var(--theme-border)]">
        <Notice msg={msgs[section]} />
        <SaveBtn loading={loading} label={label} color={color} />
    </div>
);

/* ── Main Settings ─────────────────────────────────────────────────────────── */
const Settings = () => {
    const { user, settings, fetchSettings } = useContext(AuthContext);
    const [generalConfig, setGeneralConfig] = useState({
        restaurantName: '', address: '', currency: 'INR', currencySymbol: '₹',
        sgst: 0, cgst: 0, gstNumber: '',
        pendingColor: '#fcb336', readyColor: '#10b981',
        paymentColor: '#140731',
        dashboardView: 'all',
        menuView: 'grid',
        dineInEnabled: true, tableMapEnabled: true, takeawayEnabled: true, waiterServiceEnabled: true,
        enforceMenuView: false,
        mobileMenuView: 'list',
        cashierOfferEnabled: false,
        cashierOfferLabel: '',
        cashierOfferDiscount: 0,
        cashierQrUploadEnabled: true,
    });
    const [passwordData, setPasswordData] = useState({ role: 'admin', newPassword: '', confirmPassword: '' });
    const [qrUrls, setQrUrls] = useState({ standardQrUrl: null, secondaryQrUrl: null });
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [msgs, setMsgs] = useState({});

    const setMsg = (key, type, text) => {
        setMsgs(p => ({ ...p, [key]: { type, text } }));
        setTimeout(() => setMsgs(p => { const n = { ...p }; delete n[key]; return n; }), 4000);
    };

    useEffect(() => {
        if (settings) {
            setGeneralConfig({
                restaurantName: settings.restaurantName || '',
                address: settings.address || '',
                currency: settings.currency || 'INR',
                currencySymbol: settings.currencySymbol || '₹',
                sgst: settings.sgst || 0,
                cgst: settings.cgst || 0,
                gstNumber: settings.gstNumber || '',
                pendingColor: settings.pendingColor || '#3b82f6',
                acceptedColor: settings.acceptedColor || '#8b5cf6',
                preparingColor: settings.preparingColor || '#f59e0b',
                readyColor: settings.readyColor || '#10b981',
                paymentColor: settings.paymentColor || '#8b5cf6',
                dashboardView: settings.dashboardView || 'all',
                menuView: settings.menuView || 'grid',
                dineInEnabled: settings.dineInEnabled !== false,
                tableMapEnabled: settings.tableMapEnabled !== false,
                takeawayEnabled: settings.takeawayEnabled !== false,
                waiterServiceEnabled: settings.waiterServiceEnabled !== false,
                enforceMenuView: settings.enforceMenuView === true,
                mobileMenuView: settings.mobileMenuView || 'list',
                cashierOfferEnabled: settings.cashierOfferEnabled === true,
                cashierOfferLabel: settings.cashierOfferLabel || '',
                cashierOfferDiscount: settings.cashierOfferDiscount || 0,
                cashierQrUploadEnabled: settings.cashierQrUploadEnabled !== false,
            });
        }
    }, [settings]);

    // Sync QR URLs from context settings (updates via socket when cashier uploads)
    useEffect(() => {
        if (settings) {
            setQrUrls({
                standardQrUrl: settings.standardQrUrl || null,
                secondaryQrUrl: settings.secondaryQrUrl || null,
            });
        }
    }, [settings]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setGeneralConfig(prev => {
            const upd = { ...prev, [name]: value };
            if (name === 'currency') {
                if (value === 'INR') upd.currencySymbol = '₹';
                else if (value === 'USD') upd.currencySymbol = '$';
                else if (value === 'EUR') upd.currencySymbol = '€';
            }
            return upd;
        });
    };

    const saveConfig = async (e, key = 'general') => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            if (!navigator.onLine) {
                const action = { type: 'settings', method: 'PUT', endpoint: '/api/settings', data: generalConfig };
                await queueAction(action);
                await saveSetting('generalConfig', generalConfig);
                setMsg(key, 'success', 'Saved offline - will sync when online');
                setLoading(false);
                return;
            }
            await api.put('/api/settings', generalConfig, { headers: { Authorization: `Bearer ${user.token}` } });
            await saveSetting('generalConfig', generalConfig);
            if (fetchSettings) await fetchSettings();
            setMsg(key, 'success', 'Saved successfully');
        } catch (err) {
            setMsg(key, 'error', err.response?.data?.message || 'Save failed');
        }
        setLoading(false);
    };

    const savePassword = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) return setMsg('security', 'error', 'Passwords do not match');
        if (passwordData.newPassword.length < 6) return setMsg('security', 'error', 'Minimum 6 characters');
        setLoading(true);
        try {
            await api.post('/api/settings/change-password',
                { role: passwordData.role, newPassword: passwordData.newPassword },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            setMsg('security', 'success', `Password updated for ${passwordData.role}`);
            setPasswordData({ role: 'admin', newPassword: '', confirmPassword: '' });
        } catch (err) {
            setMsg('security', 'error', err.response?.data?.message || 'Update failed');
        }
        setLoading(false);
    };

    if (!settings) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <p className="text-sm text-[var(--theme-text-muted)]">Loading settings...</p>
        </div>
    );

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5 pb-28">

            {/* Page title */}
            <div className="mb-1">
                <h1 className="text-xl font-bold text-[var(--theme-text-main)]">Settings</h1>
                <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">Manage restaurant configuration</p>
            </div>

            {/* Feature Toggles */}
            <Card>
                <SectionHeader icon={Shield} title="Order Types" color="orange" />
                <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-[var(--theme-border)]">
                        <div>
                            <p className="text-sm font-semibold text-[var(--theme-text-main)]">Dine-In Orders</p>
                            <p className="text-xs text-[var(--theme-text-muted)]">Table-based dine-in orders</p>
                        </div>
                        <button type="button" onClick={() => setGeneralConfig(p => ({ ...p, dineInEnabled: !p.dineInEnabled }))}>
                            {generalConfig.dineInEnabled ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} className="text-gray-400" />}
                        </button>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[var(--theme-border)]">
                        <div>
                            <p className="text-sm font-semibold text-[var(--theme-text-main)]">Takeaway Orders</p>
                            <p className="text-xs text-[var(--theme-text-muted)]">Token-based takeaway orders</p>
                        </div>
                        <button type="button" onClick={() => setGeneralConfig(p => ({ ...p, takeawayEnabled: !p.takeawayEnabled }))}>
                            {generalConfig.takeawayEnabled ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} className="text-gray-400" />}
                        </button>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="text-sm font-semibold text-[var(--theme-text-main)]">Table Map</p>
                            <p className="text-xs text-[var(--theme-text-muted)]">Show table layout in waiter</p>
                        </div>
                        <button type="button" onClick={() => setGeneralConfig(p => ({ ...p, tableMapEnabled: !p.tableMapEnabled }))}>
                            {generalConfig.tableMapEnabled ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} className="text-gray-400" />}
                        </button>
                    </div>
                    <div className="pt-3 border-t border-[var(--theme-border)]">
                        <button type="button" onClick={e => saveConfig(e, 'features')} disabled={loading}
                            className="h-10 px-6 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-orange-600/20 disabled:opacity-50 flex items-center gap-2">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save Features
                        </button>
                    </div>
                </div>
            </Card>

            {/* Business Info */}
            <Card>
                <SectionHeader icon={Building2} title="Business Information" color="blue" />
                <form onSubmit={saveConfig} className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <Field label="Restaurant Name">
                            <input type="text" name="restaurantName" value={generalConfig.restaurantName} onChange={handleChange} className={inputCls} />
                        </Field>
                        <Field label="Address">
                            <input type="text" name="address" value={generalConfig.address} onChange={handleChange} className={inputCls} />
                        </Field>
                        <Field label="Currency">
                            <select name="currency" value={generalConfig.currency} onChange={handleChange} className={inputCls}>
                                <option value="INR">INR (₹)</option>
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                            </select>
                        </Field>
                        <Field label="Currency Symbol">
                            <input type="text" name="currencySymbol" value={generalConfig.currencySymbol} onChange={handleChange} maxLength={3} className={inputCls} />
                        </Field>
                        <Field label="GST / VAT No.">
                            <input type="text" name="gstNumber" value={generalConfig.gstNumber} onChange={handleChange} className={inputCls} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="SGST (%)">
                                <input type="number" name="sgst" value={generalConfig.sgst} onChange={handleChange} step="0.1" min="0" className={inputCls} />
                            </Field>
                            <Field label="CGST (%)">
                                <input type="number" name="cgst" value={generalConfig.cgst} onChange={handleChange} step="0.1" min="0" className={inputCls} />
                            </Field>
                        </div>
                    </div>

                    {/* Cashier Payment Offer */}
                    {/* <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 dark:border-amber-500/20">
                            <div className="flex items-center gap-2">
                                <Tag size={15} className="text-amber-500" />
                                <p className="text-xs font-semibold text-[var(--theme-text-main)]">Cashier Payment Offer</p>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">Optional</span>
                            </div>
                            <button type="button"
                                onClick={() => setGeneralConfig(p => ({ ...p, cashierOfferEnabled: !p.cashierOfferEnabled }))}
                                className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 transition-opacity">
                                {generalConfig.cashierOfferEnabled
                                    ? <ToggleRight size={22} className="text-amber-500" />
                                    : <ToggleLeft size={22} className="text-gray-400" />}
                                <span>{generalConfig.cashierOfferEnabled ? 'Enabled' : 'Disabled'}</span>
                            </button>
                        </div>
                        {generalConfig.cashierOfferEnabled && (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Offer Label (e.g. Happy Hour, Weekend Deal)">
                                    <input type="text" name="cashierOfferLabel"
                                        value={generalConfig.cashierOfferLabel}
                                        onChange={handleChange}
                                        placeholder="e.g. Happy Hour Discount"
                                        className={inputCls} />
                                </Field>
                                <Field label="Discount (%)">
                                    <input type="number" name="cashierOfferDiscount"
                                        value={generalConfig.cashierOfferDiscount}
                                        onChange={handleChange}
                                        min="0" max="100" step="0.5"
                                        className={inputCls} />
                                </Field>
                                <div className="sm:col-span-2">
                                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                                        <CheckCircle2 size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                                            Cashier will see a <strong>"{generalConfig.cashierOfferLabel || 'Offer'}"</strong> button during payment to apply <strong>{generalConfig.cashierOfferDiscount}% off</strong> to the bill.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div> */}

                    <Footer section="general" color="blue" label="Save Business Details" msgs={msgs} loading={loading} />
                </form>
            </Card>

            {/* QR Codes */}
            <Card>
                <SectionHeader icon={QrCode} title="Payment QR Codes" color="violet" />
                <div className="p-5 space-y-3">
                    <p className="text-xs text-[var(--theme-text-muted)]">Upload QR codes for cashier payment processing.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <QrCard label="Standard QR" type="standard" currentUrl={qrUrls.standardQrUrl} token={user?.token}
                            onUploaded={res => setQrUrls(p => ({ ...p, standardQrUrl: res.standardQrUrl }))} isSecondary={false} />
                        <QrCard label="Secondary QR" type="secondary" currentUrl={qrUrls.secondaryQrUrl} token={user?.token}
                            onUploaded={res => setQrUrls(p => ({ ...p, secondaryQrUrl: res.secondaryQrUrl }))} isSecondary={true} />
                    </div>

                </div>
            </Card>

            {/* Order Status Colors */}
            <Card>
                <SectionHeader icon={Palette} title="Order Status Colors" color="emerald" />
                <div className="p-5">
                    <div className="flex flex-col gap-3 mb-4">
                        {[
                            { key: 'pending', label: 'Pending' },
                            { key: 'ready', label: 'Ready' },
                            { key: 'payment', label: 'Payment' },
                        ].map(({ key, label }) => (
                            <div key={key} className="flex items-center gap-3">
                                {/* Color swatch + native picker */}
                                <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-[var(--theme-border)] relative shrink-0 shadow-sm"
                                    style={{ backgroundColor: generalConfig[`${key}Color`] }}>
                                    <input type="color" name={`${key}Color`} value={generalConfig[`${key}Color`]}
                                        onChange={handleChange}
                                        title="Click to pick color"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                </div>
                                {/* Label */}
                                <p className="text-xs font-bold text-[var(--theme-text-main)] w-24 shrink-0">{label}</p>
                                {/* Manual hex input */}
                                <input
                                    type="text"
                                    value={generalConfig[`${key}Color`].toUpperCase()}
                                    onChange={e => {
                                        const val = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value;
                                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                            setGeneralConfig(prev => ({ ...prev, [`${key}Color`]: val }));
                                        }
                                    }}
                                    maxLength={7}
                                    placeholder="#000000"
                                    className="font-mono text-[10px] w-28 px-3 py-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg-muted)] text-[var(--theme-text-main)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 uppercase tracking-widest shadow-inner font-black"
                                />
                                {/* Live preview dot */}
                                <div className="w-2.5 h-2.5 rounded-full border border-[var(--theme-border)] shrink-0 ml-1"
                                    style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(generalConfig[`${key}Color`]) ? generalConfig[`${key}Color`] : 'transparent' }} />
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-[var(--theme-border)] bg-[var(--theme-bg-muted)]/30 -mx-5 px-5 py-4 mt-4">
                        <Notice msg={msgs['colors']} />
                        <button type="button" onClick={e => saveConfig(e, 'colors')} disabled={loading}
                            className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 flex items-center gap-2">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={16} />}
                            Save Status Colors
                        </button>
                    </div>
                </div>
            </Card>

            {/* Live Dashboard Layout */}
            <Card>
                <SectionHeader icon={Grid} title="Live Dashboard Preferences" color="orange" />
                <div className="p-5">
                    <p className="text-[10px] text-[var(--theme-text-muted)] uppercase font-black tracking-widest mb-4">Orders Display mode</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-[var(--theme-bg-dark)] border border-[var(--theme-border)] rounded-xl">
                        {[
                            { id: 'one', icon: List, label: 'Single' },
                            { id: 'two', icon: Grid, label: 'Dual' },
                            { id: 'all', icon: LayoutGrid, label: 'Standard' },
                            { id: 'prod', icon: Grid2X2, label: 'Token Mode' },
                        ].map(opt => (
                            <button key={opt.id} type="button"
                                onClick={() => setGeneralConfig({ ...generalConfig, dashboardView: opt.id })}
                                className={`flex items-center justify-center gap-2 h-11 rounded-lg text-xs font-semibold transition-all ${generalConfig.dashboardView === opt.id
                                        ? 'bg-orange-500 text-white shadow-md'
                                        : 'text-[var(--theme-text-muted)] hover:bg-[var(--theme-bg-hover)]'
                                    }`}>
                                <opt.icon size={16} />
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-5 mt-4 border-t border-[var(--theme-border)]">
                        <Notice msg={msgs['layout']} />
                        <button type="button" onClick={e => saveConfig(e, 'layout')} disabled={loading}
                            className="h-10 px-6 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-orange-600/20 disabled:opacity-50 flex items-center gap-2">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save Dashboard Layout
                        </button>
                    </div>
                </div>
            </Card>

            {/* POS Menu Layout */}
            <Card>
                <SectionHeader icon={LayoutGrid} title="POS Menu Appearance" color="violet" />
                <div className="p-5">
                    <p className="text-[10px] text-[var(--theme-text-muted)] uppercase font-black tracking-widest mb-4">Food Item Grid Mode</p>
                    <div className="grid grid-cols-3 gap-2 p-1.5 bg-[var(--theme-bg-dark)] border border-[var(--theme-border)] rounded-xl">
                        {[
                            { id: 'grid', icon: LayoutGrid, label: 'Standard' },
                            { id: 'compact', icon: Grid2X2, label: 'Compact' },
                            { id: 'list', icon: List, label: 'List View' },
                        ].map(opt => (
                            <button key={opt.id} type="button"
                                onClick={() => setGeneralConfig({ ...generalConfig, menuView: opt.id })}
                                className={`flex items-center justify-center gap-2 h-11 rounded-lg text-xs font-semibold transition-all ${generalConfig.menuView === opt.id
                                        ? 'bg-violet-600 text-white shadow-md'
                                        : 'text-[var(--theme-text-muted)] hover:bg-[var(--theme-bg-hover)]'
                                    }`}>
                                <opt.icon size={16} />
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className="mt-5 flex items-center justify-between p-4 bg-violet-600/5 border border-violet-500/20 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${generalConfig.enforceMenuView ? 'bg-violet-600' : 'bg-gray-700'} text-white transition-colors`}>
                                <Lock size={18} />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-[var(--theme-text-main)]">Enforce this view</p>
                                <p className="text-[10px] text-[var(--theme-text-muted)] italic">Hides layout toggles on all POS terminals</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setGeneralConfig({ ...generalConfig, enforceMenuView: !generalConfig.enforceMenuView })}
                            className={`w-12 h-6 rounded-full transition-all flex items-center px-1 shrink-0 ${generalConfig.enforceMenuView ? 'bg-violet-600' : 'bg-gray-600'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-lg transition-transform ${generalConfig.enforceMenuView ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="mt-8">
                        <p className="text-[10px] text-[var(--theme-text-muted)] uppercase font-black tracking-widest mb-4">Mobile Food Item Grid Mode</p>
                        <div className="grid grid-cols-3 gap-2 p-1.5 bg-[var(--theme-bg-dark)] border border-[var(--theme-border)] rounded-xl">
                            {[
                                { id: 'grid', icon: LayoutGrid, label: 'Standard' },
                                { id: 'compact', icon: Grid2X2, label: 'Compact' },
                                { id: 'list', icon: List, label: 'List View' },
                            ].map(opt => (
                                <button key={opt.id} type="button"
                                    onClick={() => setGeneralConfig({ ...generalConfig, mobileMenuView: opt.id })}
                                    className={`flex items-center justify-center gap-2 h-11 rounded-lg text-xs font-semibold transition-all ${generalConfig.mobileMenuView === opt.id
                                            ? 'bg-rose-600 text-white shadow-md'
                                            : 'text-[var(--theme-text-muted)] hover:bg-[var(--theme-bg-hover)]'
                                        }`}>
                                    <opt.icon size={16} />
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-[var(--theme-text-subtle)] mt-2 italic px-1">Specific layout applied only when accessed from mobile devices.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-5 mt-4 border-t border-[var(--theme-border)]">
                        <Notice msg={msgs['menu_layout']} />
                        <button type="button" onClick={e => saveConfig(e, 'menu_layout')} disabled={loading}
                            className="h-10 px-6 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-violet-500/20 disabled:opacity-50 flex items-center gap-2">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save Menu Layout
                        </button>
                    </div>
                </div>
            </Card>

            {/* Password */}
            <Card>
                <SectionHeader icon={Shield} title="Change Password" color="rose" />
                <form onSubmit={savePassword} className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <Field label="Role">
                            <select value={passwordData.role} onChange={e => setPasswordData({ ...passwordData, role: e.target.value })}
                                className={inputCls.replace('focus:border-blue-500 focus:ring-blue-500/10', 'focus:border-rose-500 focus:ring-rose-500/10')}>
                                <option value="admin">Admin</option>
                                <option value="waiter">Waiter</option>
                                <option value="kitchen">Kitchen</option>
                                <option value="cashier">Cashier</option>
                            </select>
                        </Field>
                        <Field label="New Password">
                            <div className="relative">
                                <input type={showNew ? 'text' : 'password'} value={passwordData.newPassword}
                                    onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    placeholder="••••••••"
                                    className={`${inputCls.replace('focus:border-blue-500 focus:ring-blue-500/10', 'focus:border-rose-500 focus:ring-rose-500/10')} pr-10`} />
                                <button type="button" onClick={() => setShowNew(!showNew)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-subtle)] hover:text-[var(--theme-text-main)] transition-colors">
                                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </Field>
                        <Field label="Confirm Password">
                            <div className="relative">
                                <input type={showConfirm ? 'text' : 'password'} value={passwordData.confirmPassword}
                                    onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    placeholder="••••••••"
                                    className={`${inputCls.replace('focus:border-blue-500 focus:ring-blue-500/10', 'focus:border-rose-500 focus:ring-rose-500/10')} pr-10`} />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-subtle)] hover:text-[var(--theme-text-main)] transition-colors">
                                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </Field>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-5 border-t border-[var(--theme-border)]">
                        <Notice msg={msgs['security']} />
                        <button type="submit" disabled={loading}
                            className="h-10 px-6 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center gap-2">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                            Apply New Password
                        </button>
                    </div>
                </form>
            </Card>

        </div>
    );
};

export default Settings;
