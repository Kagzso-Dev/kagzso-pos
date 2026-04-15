import { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import { getMenus, saveMenus, getCategories, saveCategories } from '../../db/db';
import { queueAction } from '../../utils/syncEngine';
import { Plus, Search, SearchX, Utensils, Upload, X } from 'lucide-react';
import ViewToggle from '../../components/ViewToggle';
import FoodItem from '../../components/FoodItem';
import useDebounce from '../../hooks/useDebounce';
import OptimizedImage from '../../components/OptimizedImage';


const AdminMenu = () => {
    const { user, formatPrice, socket, settings } = useContext(AuthContext);
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 250);
    const [filterCategory, setFilterCategory] = useState(null);
    const [formError, setFormError] = useState('');

    const [formData, setFormData] = useState({
        name: '', description: '', price: '', category: '', image: '', isVeg: true, availability: true, variants: [],
    });
    const [imageUploading, setImageUploading] = useState(false);
    const imageFileRef = useRef(null);
    const [userInteracted, setUserInteracted] = useState(false);
    const [viewMode, setViewMode] = useState(() => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        if (isMobile && settings?.mobileMenuView) return settings.mobileMenuView;
        return settings?.menuView || 'grid'
    });

    // Sync with global settings
    useEffect(() => {
        const isMobile = window.innerWidth < 768;
        const defaultView = (isMobile && settings?.mobileMenuView) ? settings.mobileMenuView : (settings?.menuView || 'grid');

        if (settings?.enforceMenuView) {
            setViewMode(defaultView);
        } else if (!userInteracted && (settings?.menuView || settings?.mobileMenuView)) {
            setViewMode(defaultView);
        }
    }, [settings?.menuView, settings?.mobileMenuView, settings?.enforceMenuView, userInteracted]);

    // Manual override helper
    const handleViewToggle = (newMode) => {
        setViewMode(newMode);
        setUserInteracted(true);
        localStorage.setItem('adminMenuViewMode', newMode);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // ── Real-time socket subscriptions ─────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onMenuUpdated = ({ action, item, id }) => {
            if (action === 'create' && item) {
                // Deduplicate: socket may fire after the API response already added the item
                setItems(prev => prev.find(i => i._id === item._id) ? prev.map(i => i._id === item._id ? item : i) : [...prev, item]);
            } else if (action === 'update' && item) {
                setItems(prev => prev.map(i => i._id === item._id ? item : i));
            } else if (action === 'delete' && id) {
                setItems(prev => prev.filter(i => String(i._id) !== String(id)));
            }
        };

        const onCategoryUpdated = ({ action, category, id }) => {
            if (action === 'create' && category) {
                setCategories(prev => prev.find(c => c._id === category._id) ? prev : [...prev, category]);
            } else if (action === 'update' && category) {
                setCategories(prev => prev.map(c => c._id === category._id ? category : c));
            } else if (action === 'delete' && id) {
                setCategories(prev => prev.filter(c => String(c._id) !== String(id)));
                if (filterCategory === id) setFilterCategory(null);
            }
        };

        socket.on('menu-updated', onMenuUpdated);
        socket.on('category-updated', onCategoryUpdated);
        return () => {
            socket.off('menu-updated', onMenuUpdated);
            socket.off('category-updated', onCategoryUpdated);
        };
    }, [socket, filterCategory]);

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

    const fetchData = async () => {
        if (!navigator.onLine) {
            const { getMenus, getCategories } = await import('../../db/db');
            const [cachedItems, cachedCategories] = await Promise.all([
                getMenus(),
                getCategories(),
            ]);
            setItems(cachedItems || []);
            setCategories(cachedCategories || []);
            return;
        }
        try {
            const [menuRes, catRes] = await Promise.all([
                api.get('/api/menu'),
                api.get('/api/categories'),
            ]);
            setItems(menuRes.data);
            setCategories(catRes.data);
        } catch (error) {
            console.error(error);
            const { getMenus, getCategories } = await import('../../db/db');
            const [cachedItems, cachedCategories] = await Promise.all([
                getMenus(),
                getCategories(),
            ]);
            setItems(cachedItems || []);
            setCategories(cachedCategories || []);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Permanently delete this item?')) return;
        try {
            if (!navigator.onLine) {
                const action = { type: 'menu', method: 'DELETE', endpoint: `/api/menu/${id}` };
                await queueAction(action);
                setItems(prev => prev.filter(i => String(i._id) !== String(id)));
                alert('Item will be deleted when online.');
                return;
            }
            await api.delete(`/api/menu/${id}`, { headers: { Authorization: `Bearer ${user.token}` } });
            setItems(prev => prev.filter(i => String(i._id) !== String(id)));
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to delete item');
        }
    };

    const handleToggleAvailability = async (item) => {
        try {
            if (!navigator.onLine) {
                const action = { type: 'menu', method: 'PUT', endpoint: `/api/menu/${item._id}`, data: { availability: !item.availability } };
                await queueAction(action);
                setItems(prev => prev.map(i => i._id === item._id ? { ...i, availability: !item.availability } : i));
                alert('Availability will be updated when online.');
                return;
            }
            await api.put(`/api/menu/${item._id}`, { availability: !item.availability }, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to update availability');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        const cleanVariants = (formData.variants || [])
            .filter(v => v.name.trim())
            .map(v => ({ name: v.name.trim(), price: parseFloat(v.price) || 0 }));
        const submitData = { ...formData, variants: cleanVariants };
        try {
            if (editingItem) {
                if (!navigator.onLine) {
                    const action = { type: 'menu', method: 'PUT', endpoint: `/api/menu/${editingItem._id}`, data: submitData };
                    await queueAction(action);
                    setItems(prev => prev.map(i => i._id === editingItem._id ? { ...i, ...submitData } : i));
                    alert('Item will be updated when online.');
                    closeModal();
                    return;
                }
                const res = await api.put(`/api/menu/${editingItem._id}`, submitData, {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
                setItems(prev => prev.map(i => i._id === editingItem._id ? res.data : i));
            } else {
                if (!navigator.onLine) {
                    const localId = `local_menu_${Date.now()}`;
                    const newItem = { ...submitData, _id: localId, availability: true };
                    setItems(prev => [...prev, newItem]);
                    const action = { type: 'menu', method: 'POST', endpoint: '/api/menu', data: submitData };
                    await queueAction(action);
                    alert('Item will be created when online.');
                    closeModal();
                    return;
                }
                const res = await api.post('/api/menu', submitData, {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
                // Deduplicate in case socket fires first
                setItems(prev => prev.find(i => i._id === res.data._id) ? prev : [...prev, res.data]);
            }
            closeModal();
        } catch (error) {
            setFormError(error.response?.data?.message || 'Failed to save item');
        }
    };

    const openModal = (item = null) => {
        setFormError('');
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                description: item.description || '',
                price: item.price,
                category: item.category?._id || item.category,
                image: item.image || '',
                isVeg: item.isVeg,
                availability: item.availability,
                variants: item.variants || [],
            });
        } else {
            setEditingItem(null);
            setFormData({
                name: '', description: '', price: '',
                category: categories.find(c => c.status === 'active')?._id || categories[0]?._id || '',
                image: '', isVeg: true, availability: true, variants: [],
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormError('');
    };

    // ── Filtered items ─────────────────────────────────────────────────────
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchCat = filterCategory ? String(item.category?._id) === String(filterCategory) : true;
            const matchSearch = item.name.toLowerCase().includes(debouncedSearch.toLowerCase());
            return matchCat && matchSearch;
        });
    }, [items, filterCategory, debouncedSearch]);

    const activeCategories = categories.filter(c => c.status === 'active');

    return (
        <div className="space-y-5 pb-40 animate-fade-in">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--theme-bg-card2)] px-5 py-4 rounded-2xl shadow-sm border border-[var(--theme-border)] gap-3">
                <div>
                    <h2 className="text-xl font-bold text-[var(--theme-text-main)]">Menu Items</h2>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                        {items.length} total &middot; <span className="text-emerald-400 font-semibold">{items.filter(i => i.availability).length} available</span>
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {!settings?.enforceMenuView && <ViewToggle viewMode={viewMode} setViewMode={handleViewToggle} />}
                    <button
                        onClick={() => openModal()}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl transition-colors font-semibold text-sm min-h-[44px] shadow-md shadow-blue-600/20"
                    >
                        <Plus size={16} />
                        <span>Add Item</span>
                    </button>
                </div>
            </div>

            {/* ── Search + Category Filter ─────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" size={15} />
                    <input
                        type="text"
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--theme-bg-card)] text-[var(--theme-text-main)] rounded-xl pl-9 pr-9 py-2.5 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none text-sm"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[var(--theme-text-main)] transition-colors">
                            <SearchX size={14} />
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setFilterCategory(null)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold border transition-all whitespace-nowrap ${filterCategory === null ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/30' : 'bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:border-blue-500 hover:text-[var(--theme-text-main)]'}`}
                    >
                        All
                    </button>
                    {activeCategories.map(cat => (
                        <button
                            key={cat._id}
                            onClick={() => setFilterCategory(cat._id)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold border transition-all whitespace-nowrap ${String(filterCategory) === String(cat._id) ? 'text-white border-transparent shadow-sm' : 'bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:border-blue-500 hover:text-[var(--theme-text-main)]'}`}
                            style={String(filterCategory) === String(cat._id) ? { backgroundColor: cat.color || '#3b82f6', boxShadow: `0 2px 8px ${cat.color || '#3b82f6'}40` } : {}}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Items Grid / List ────────────────────────────────────── */}
            <div className="w-full max-w-[1400px] mx-auto pb-10">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-[var(--theme-text-muted)]">
                        <Utensils size={44} className="mb-3 opacity-20" />
                        <p className="font-bold text-base">No items found</p>
                        <p className="text-sm opacity-70 mt-1">Try a different search or category</p>
                    </div>
                ) : (
                    <div className={
                        viewMode === 'grid'
                            ? 'grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]'
                            : 'flex flex-col gap-3'
                    }>
                        {filteredItems.map(item => (
                            <div key={item._id} className={!item.availability ? 'opacity-60' : ''}>
                                <FoodItem
                                    item={item}
                                    viewMode={viewMode}
                                    formatPrice={formatPrice}
                                    onEdit={openModal}
                                    onDelete={handleDelete}
                                    onToggleAvailability={handleToggleAvailability}
                                    isAdmin={true}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Modal (Right Drawer) ────────────────────────────────── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1000] flex justify-end animate-fade-in px-2 sm:px-0">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={closeModal} />
                    <div className="relative z-10 w-full sm:w-[400px] bg-[var(--theme-bg-card)] shadow-2xl flex flex-col h-full border-l border-[var(--theme-border)] animate-slide-left pb-[64px] sm:pb-0 rounded-t-3xl sm:rounded-none">
                        {/* Header & Actions */}
                        <div className="px-5 py-5 border-b border-[var(--theme-border)] bg-[var(--theme-bg-card2)] shrink-0 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black text-[var(--theme-text-main)] uppercase tracking-tighter leading-none">
                                        {editingItem ? 'Edit Item' : 'Add New Item'}
                                    </h3>
                                    <p className="text-[9px] text-[var(--theme-text-muted)] font-black uppercase tracking-[0.2em] mt-1.5 opacity-60">Item Configuration</p>
                                </div>
                                <button onClick={closeModal} className="p-2 hover:bg-[var(--theme-bg-hover)] rounded-xl transition-colors text-[var(--theme-text-muted)] hover:text-red-500">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <button type="button" onClick={closeModal} className="flex-1 h-11 text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded-xl transition-all border border-[var(--theme-border)] bg-[var(--theme-bg-card)]">
                                    Cancel
                                </button>
                                <button type="submit" form="menu-item-form" className="flex-[1.8] h-11 bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-all font-black text-[11px] uppercase tracking-[0.1em] shadow-lg shadow-orange-600/20 active:scale-95 flex items-center justify-center gap-2">
                                    <Plus size={16} />
                                    {editingItem ? 'Update Item' : 'Save Item'}
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 kot-scroll p-5 space-y-4 custom-scrollbar pb-10">
                            {formError && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium animate-shake">
                                    {formError}
                                </div>
                            )}

                            <form id="menu-item-form" onSubmit={handleSubmit} className="space-y-4">
                                {/* Basic Info */}
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-1.5 ml-1">Name *</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="e.g. Masala Dosa"
                                            className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl px-4 py-2.5 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none transition-all text-sm font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-1.5 ml-1">Description</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Ingredients, style..."
                                            className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl px-4 py-2.5 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none transition-all text-sm"
                                            rows="2"
                                        />
                                    </div>
                                </div>

                                {/* Pricing & Category */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-1.5 ml-1">Base Price *</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                                            required
                                            className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl px-4 py-2.5 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none transition-all text-sm font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-1.5 ml-1">Category *</label>
                                        <select
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            required
                                            className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl px-4 py-2.5 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none transition-all text-sm font-bold appearance-none"
                                        >
                                            <option value="">-- Select --</option>
                                            {categories.map(c => (
                                                <option key={c._id} value={c._id}>
                                                    {c.name}{c.status === 'inactive' ? ' (inactive)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Image Upload */}
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-[var(--theme-text-muted)] mb-1.5 ml-1">Image</label>

                                    {/* Preview */}
                                    {formData.image && (
                                        <OptimizedImage 
                                            src={formData.image} 
                                            alt="Preview" 
                                            aspectRatio="aspect-video"
                                            containerClassName="w-full h-32 rounded-xl border border-[var(--theme-border)] mb-2"
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

                                    {/* Upload button */}
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

                                    {/* URL fallback */}
                                    <input
                                        type="text"
                                        value={formData.image}
                                        onChange={e => setFormData({ ...formData, image: e.target.value })}
                                        placeholder="Or paste an image URL..."
                                        className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl px-4 py-2 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none transition-all text-xs"
                                    />
                                </div>

                                {/* Toggles */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(f => ({ ...f, isVeg: !f.isVeg }))}
                                        className={`px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-1.5 ${formData.isVeg ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-gray-500/5 text-gray-500 border-gray-500/20'}`}
                                    >
                                        <span className="text-[9px] font-black uppercase tracking-widest">Veg</span>
                                        <div className={`w-7 h-3.5 rounded-full relative transition-colors ${formData.isVeg ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                                            <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${formData.isVeg ? 'left-4' : 'left-0.5'}`} />
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData(f => ({ ...f, availability: !f.availability }))}
                                        className={`px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-1.5 ${formData.availability ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}
                                    >
                                        <span className="text-[9px] font-black uppercase tracking-widest">Stock</span>
                                        <div className={`w-7 h-3.5 rounded-full relative transition-colors ${formData.availability ? 'bg-blue-500' : 'bg-gray-600'}`}>
                                            <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${formData.availability ? 'left-4' : 'left-0.5'}`} />
                                        </div>
                                    </button>
                                </div>

                                {/* Portion Sizes */}
                                <div className="bg-[var(--theme-bg-dark)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                                    <div className="px-4 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-bg-card2)] flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-main)]">Portion Sizes</label>
                                        <button 
                                            type="button" 
                                            onClick={() => setFormData(f => ({ ...f, variants: [...(f.variants || []), { name: '', price: '' }] }))}
                                            className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all"
                                        >
                                            <Plus size={12} /> Add Size
                                        </button>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {(formData.variants || []).length === 0 && (
                                            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex gap-3 items-start">
                                                <div className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                    <span className="text-orange-500 text-[10px]">!</span>
                                                </div>
                                                <p className="text-[10px] text-orange-300 font-bold uppercase leading-normal">
                                                    No sizes added. Customers will order at the base price.
                                                </p>
                                            </div>
                                        )}
                                        {(formData.variants || []).map((v, idx) => (
                                            <div key={idx} className="flex gap-2 items-center animate-slide-right" style={{ animationDelay: `${idx * 50}ms` }}>
                                                <input
                                                    type="text"
                                                    placeholder="Half"
                                                    value={v.name}
                                                    onChange={e => setFormData(f => ({ ...f, variants: f.variants.map((x, i) => i === idx ? { ...x, name: e.target.value } : x) }))}
                                                    className="flex-1 bg-[var(--theme-bg-card2)] text-[var(--theme-text-main)] rounded-lg px-3 py-2 border border-[var(--theme-border)] focus:border-blue-500 transition-all text-xs"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Price"
                                                    value={v.price}
                                                    onChange={e => setFormData(f => ({ ...f, variants: f.variants.map((x, i) => i === idx ? { ...x, price: e.target.value } : x) }))}
                                                    className="w-24 bg-[var(--theme-bg-card2)] text-[var(--theme-text-main)] rounded-lg px-3 py-2 border border-[var(--theme-border)] focus:border-blue-500 transition-all text-xs font-bold"
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setFormData(f => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }))}
                                                    className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                >
                                                    <Plus size={16} className="rotate-45" />
                                                </button>
                                            </div>
                                        ))}
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

export default AdminMenu;

