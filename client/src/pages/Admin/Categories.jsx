import { useState, useEffect, useContext, useRef } from 'react';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Trash2, Plus, Edit2, Upload, X } from 'lucide-react';
import ViewToggle from '../../components/ViewToggle';
import OptimizedImage from '../../components/OptimizedImage';
import { getCategories, saveCategories } from '../../db/db';
import { queueAction } from '../../utils/syncEngine';

const AdminCategories = () => {
    const [categories, setCategories] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '', color: '#3b82f6', status: 'active', image: '' });
    const [formError, setFormError] = useState('');
    const [imageUploading, setImageUploading] = useState(false);
    const imageFileRef = useRef(null);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('categoryViewMode') || 'grid');
    const { user, socket } = useContext(AuthContext);

    useEffect(() => {
        localStorage.setItem('categoryViewMode', viewMode);
    }, [viewMode]);

    const presetColors = [
        { name: 'Blue', hex: '#3b82f6' },
        { name: 'Red', hex: '#ef4444' },
        { name: 'Green', hex: '#10b981' },
        { name: 'Orange', hex: '#f97316' },
        { name: 'Purple', hex: '#8b5cf6' },
        { name: 'Teal', hex: '#14b8a6' },
        { name: 'Pink', hex: '#ec4899' },
    ];

    useEffect(() => {
        fetchCategories();
    }, []);

    // ── Real-time socket subscription ──────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onCategoryUpdated = ({ action, category, id }) => {
            if (action === 'create' && category) {
                setCategories(prev => prev.find(c => c._id === category._id) ? prev.map(c => c._id === category._id ? category : c) : [...prev, category]);
            } else if (action === 'update' && category) {
                setCategories(prev => prev.map(c => c._id === category._id ? category : c));
            } else if (action === 'delete' && id) {
                setCategories(prev => prev.filter(c => String(c._id) !== String(id)));
            }
        };

        socket.on('category-updated', onCategoryUpdated);
        return () => socket.off('category-updated', onCategoryUpdated);
    }, [socket]);

    const handleImageFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await api.post('/api/upload/image', fd, {
                headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'multipart/form-data' },
            });
            setFormData(f => ({ ...f, image: res.data.url }));
        } catch (err) {
            setFormError(err.response?.data?.message || 'Image upload failed');
        } finally {
            setImageUploading(false);
            if (imageFileRef.current) imageFileRef.current.value = '';
        }
    };

    const fetchCategories = async () => {
        console.log('[AdminCategories] Fetching categories from API...');
        if (!navigator.onLine) {
            console.warn('[AdminCategories] Device is offline. Loading categories from IndexedDB.');
            const cached = await getCategories();
            setCategories(cached || []);
            return;
        }
        try {
            const res = await api.get('/api/categories');
            console.log('[AdminCategories] API Response:', res.data);
            
            if (!res.data || res.data.length === 0) {
                console.warn('[AdminCategories] API returned empty categories list.');
            }
            
            setCategories(res.data || []);
            await saveCategories(res.data || []);
        } catch (error) {
            console.error("[AdminCategories] Error fetching categories:", error);
            const cached = await getCategories();
            setCategories(cached || []);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this category? This will fail if any menu items are assigned to it.')) return;
        try {
            if (!navigator.onLine) {
                const action = { type: 'category', method: 'DELETE', endpoint: `/api/categories/${id}` };
                await queueAction(action);
                setCategories(prev => prev.filter(c => String(c._id) !== String(id)));
                alert('Category will be deleted when online.');
                return;
            }
            await api.delete(`/api/categories/${id}`, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            setCategories(prev => prev.filter(c => String(c._id) !== String(id)));
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to delete category');
        }
    };

    const handleToggleStatus = async (cat) => {
        const newStatus = cat.status === 'active' ? 'inactive' : 'active';
        try {
            if (!navigator.onLine) {
                const action = { type: 'category', method: 'PUT', endpoint: `/api/categories/${cat._id}`, data: { status: newStatus } };
                await queueAction(action);
                setCategories(prev => prev.map(c => c._id === cat._id ? { ...c, status: newStatus } : c));
                alert('Status will be updated when online.');
                return;
            }
            await api.put(`/api/categories/${cat._id}`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to update status');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        try {
            if (editingCategory) {
                if (!navigator.onLine) {
                    const action = { type: 'category', method: 'PUT', endpoint: `/api/categories/${editingCategory._id}`, data: formData };
                    await queueAction(action);
                    setCategories(prev => prev.map(c => c._id === editingCategory._id ? { ...c, ...formData } : c));
                    alert('Category will be updated when online.');
                    closeModal();
                    return;
                }
                const res = await api.put(`/api/categories/${editingCategory._id}`, formData, {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
                setCategories(prev => prev.map(c => c._id === editingCategory._id ? res.data : c));
            } else {
                if (!navigator.onLine) {
                    const localId = `local_cat_${Date.now()}`;
                    const newCat = { ...formData, _id: localId };
                    setCategories(prev => [...prev, newCat]);
                    const action = { type: 'category', method: 'POST', endpoint: '/api/categories', data: formData };
                    await queueAction(action);
                    alert('Category will be created when online.');
                    closeModal();
                    return;
                }
                const res = await api.post('/api/categories', formData, {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
                setCategories(prev => prev.find(c => c._id === res.data._id) ? prev : [...prev, res.data]);
            }
            closeModal();
        } catch (error) {
            setFormError(error.response?.data?.message || 'Failed to save category');
        }
    };

    const openModal = (category = null) => {
        setFormError('');
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                description: category.description || '',
                color: category.color || '#3b82f6',
                status: category.status || 'active',
                image: category.image || '',
            });
        } else {
            setEditingCategory(null);
            setFormData({ name: '', description: '', color: '#3b82f6', status: 'active', image: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
        setFormError('');
    };

    const active = categories.filter(c => c.status === 'active');
    const inactive = categories.filter(c => c.status === 'inactive');

    return (
        <div className="space-y-6">
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-[var(--theme-bg-card2)] p-5 sm:p-6 rounded-xl shadow-lg border border-[var(--theme-border)]">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-[var(--theme-text-main)] uppercase tracking-tighter leading-tight">Categories</h2>
                    <p className="text-[10px] sm:text-sm text-[var(--theme-text-muted)] mt-1 font-bold uppercase tracking-widest opacity-60">
                        {active.length} active · {inactive.length} inactive
                    </p>
                </div>
                <div className="flex items-center gap-2 group/header-actions">
                    <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                    <button
                        onClick={() => openModal()}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 xs:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/30 whitespace-nowrap min-h-[44px]"
                    >
                        <Plus size={16} />
                        <span>Add Category</span>
                    </button>
                </div>
            </div>

            {/* ── Category Cards ───────────────────────────────────────── */}
            <div className={
                viewMode === 'grid'
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    : viewMode === 'compact'
                        ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                        : "flex flex-col gap-3"
            }>
                {categories.map(cat => {
                    const isInactive = cat.status === 'inactive';

                    if (viewMode === 'list') {
                        return (
                            <div
                                key={cat._id}
                                onClick={() => openModal(cat)}
                                className={`flex items-center justify-between p-4 bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] hover:border-blue-500/50 transition-all cursor-pointer ${isInactive ? 'opacity-60' : ''}`}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: cat.color || '#3b82f6' }}>
                                        {cat.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-[var(--theme-text-main)] truncate text-base">{cat.name}</h3>
                                        <p className="text-xs text-[var(--theme-text-muted)] truncate max-w-md">{cat.description || 'No description'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => handleToggleStatus(cat)}
                                        className={`px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${cat.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}
                                    >
                                        {cat.status}
                                    </button>
                                    <div className="flex gap-1">
                                        <button onClick={() => openModal(cat)} className="p-2 text-[var(--theme-text-muted)] hover:text-blue-400"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDelete(cat._id)} className="p-2 text-[var(--theme-text-muted)] hover:text-red-400"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    if (viewMode === 'compact') {
                        return (
                            <div
                                key={cat._id}
                                onClick={() => openModal(cat)}
                                className={`group relative bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] hover:border-blue-500/50 p-4 transition-all flex flex-col gap-2 cursor-pointer ${isInactive ? 'opacity-60' : ''}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-sm" style={{ backgroundColor: cat.color || '#3b82f6' }}>
                                        {cat.name.charAt(0)}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openModal(cat)} className="p-1 text-[var(--theme-text-muted)] hover:text-blue-400"><Edit2 size={12} /></button>
                                        <button onClick={() => handleDelete(cat._id)} className="p-1 text-[var(--theme-text-muted)] hover:text-red-400"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-[var(--theme-text-main)] text-sm truncate leading-tight">{cat.name}</h3>
                                <div className="flex justify-between items-center mt-1">
                                    <button
                                        onClick={() => handleToggleStatus(cat)}
                                        className={`w-2 h-2 rounded-full ${cat.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}
                                        title={cat.status}
                                    />
                                    <span className="text-[10px] font-mono opacity-20">#{cat._id.slice(-4).toUpperCase()}</span>
                                </div>
                            </div>
                        );
                    }

                    // Default Grid View
                    return (
                        <div
                            key={cat._id}
                            onClick={() => openModal(cat)}
                            className={`group relative bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)] hover:border-blue-500/50 hover:shadow-2xl transition-all duration-300 flex flex-col h-full overflow-hidden cursor-pointer ${isInactive ? 'opacity-60' : ''}`}
                        >
                            {/* Color Accent Bar */}
                            <div className="h-2 w-full" style={{ backgroundColor: cat.color || '#3b82f6' }} />

                            <div className="p-6 flex flex-col h-full">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-extrabold text-[var(--theme-text-main)] text-lg leading-snug truncate pr-6" title={cat.name}>
                                        {cat.name}
                                    </h3>

                                    {/* Hover Actions */}
                                    <div className="absolute top-6 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
                                        <button
                                            onClick={() => openModal(cat)}
                                            className="p-2 bg-[var(--theme-bg-card2)]/90 backdrop-blur-sm text-[var(--theme-text-muted)] hover:text-white hover:bg-blue-600 rounded-xl transition-all shadow-lg border border-[var(--theme-border)]"
                                            title="Edit Category"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat._id)}
                                            className="p-2 bg-[var(--theme-bg-card2)]/90 backdrop-blur-sm text-red-400 hover:text-white hover:bg-red-600 rounded-xl transition-all shadow-lg border border-[var(--theme-border)]"
                                            title="Delete Category"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <p className="text-[var(--theme-text-muted)] text-sm mt-1 line-clamp-3 leading-relaxed min-h-[3rem]">
                                    {cat.description || <span className="italic opacity-30">No description provided</span>}
                                </p>

                                <div className="mt-8 pt-4 border-t border-[var(--theme-border)] flex items-center justify-between">
                                    {/* Status Badge - Pill Style */}
                                    <button
                                        onClick={() => handleToggleStatus(cat)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all shadow-sm whitespace-nowrap ${
                                            cat.status === 'active'
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                        }`}
                                        title={cat.status === 'active' ? 'Click to deactivate' : 'Click to activate'}
                                    >
                                        <div className={`w-1 h-1 rounded-full ${cat.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                        {cat.status}
                                    </button>

                                    <span className="text-[10px] text-[var(--theme-text-subtle)] font-bold font-mono opacity-50">
                                        #{cat._id.slice(-4).toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Modal (Small Center) ────────────────────────────────── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center animate-cross-fade p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
                    <div className="relative z-10 w-[380px] max-w-[95vw] max-h-[80vh] bg-[var(--theme-bg-card)] shadow-[0_45px_100px_-25px_rgba(0,0,0,0.6)] flex flex-col border border-[var(--theme-border)] animate-pop-in rounded-[2.8rem] overflow-hidden">
                        
                        {/* Header & Actions */}
                        <div className="px-6 py-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg-card2)] shrink-0">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-[13px] font-black text-[var(--theme-text-main)] uppercase tracking-tighter leading-none">
                                        {editingCategory ? 'Edit Category' : 'Add Category'}
                                    </h3>
                                    <p className="text-[8px] text-[var(--theme-text-muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Management Panel</p>
                                </div>
                                <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center hover:bg-[var(--theme-bg-hover)] rounded-full transition-colors text-[var(--theme-text-muted)] hover:text-red-500">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <button type="button" onClick={closeModal} className="flex-1 h-9 text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded-xl transition-all border border-[var(--theme-border)] bg-[var(--theme-bg-card)]">
                                    Cancel
                                </button>
                                <button type="submit" form="category-form" className="flex-[1.4] h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-black text-[9px] uppercase tracking-[0.1em] shadow-lg shadow-blue-600/30 active:scale-95 flex items-center justify-center gap-2">
                                    {editingCategory ? 'Update' : 'Save Category'}
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 kot-scroll p-6 custom-scrollbar overflow-y-auto">
                            {formError && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium animate-shake">
                                    {formError}
                                </div>
                            )}

                            <form id="category-form" onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-1.5 ml-1">Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="e.g. Beverages"
                                        className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl px-4 py-2.5 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none transition-all text-sm font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-1.5 ml-1">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Brief description..."
                                        className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl px-4 py-2.5 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none transition-all text-sm"
                                        rows="2"
                                    />
                                </div>

                                {/* Image Upload */}
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-1.5 ml-1">Image</label>

                                    {formData.image && (
                                        <OptimizedImage 
                                            src={formData.image} 
                                            alt="Preview" 
                                            aspectRatio="aspect-video"
                                            containerClassName="w-full h-28 rounded-xl border border-[var(--theme-border)] mb-2"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setFormData(f => ({ ...f, image: '' }))}
                                                className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-red-600 text-white rounded-lg transition-colors z-20"
                                            >
                                                <X size={14} />
                                            </button>
                                        </OptimizedImage>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => imageFileRef.current?.click()}
                                        disabled={imageUploading}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-2 bg-[var(--theme-bg-dark)] hover:bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] rounded-xl border border-dashed border-[var(--theme-border)] hover:border-blue-500 transition-all text-xs font-bold disabled:opacity-50"
                                    >
                                        <Upload size={14} />
                                        {imageUploading ? 'Uploading...' : 'Upload from device'}
                                    </button>
                                    <input
                                        ref={imageFileRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageFileSelect}
                                    />

                                    <input
                                        type="text"
                                        value={formData.image}
                                        onChange={e => setFormData({ ...formData, image: e.target.value })}
                                        placeholder="Or paste an image URL..."
                                        className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl px-4 py-2 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none transition-all text-xs"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-2.5 ml-1">Category Color Indicator</label>
                                    <div className="flex flex-wrap gap-2.5">
                                        {presetColors.map(c => (
                                            <button
                                                key={c.hex}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color: c.hex })}
                                                className={`w-9 h-9 rounded-full border-4 transition-all ${formData.color === c.hex ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'}`}
                                                style={{ backgroundColor: c.hex }}
                                                title={c.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-2.5 ml-1">Status</label>
                                    <div className="flex gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, status: 'active' })}
                                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 ${formData.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] border-[var(--theme-border)]'}`}
                                        >
                                            <div className="w-1 h-1 rounded-full bg-current" />
                                            Active
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, status: 'inactive' })}
                                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 ${formData.status === 'inactive' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] border-[var(--theme-border)]'}`}
                                        >
                                            <div className="w-1 h-1 rounded-full bg-current" />
                                            Inactive
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCategories;

