import { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import {
    Search, ShoppingCart, ArrowLeft, ArrowRight,
    Utensils, ChevronLeft, SearchX, Trash2, Plus, Minus,
    Grid, X
} from 'lucide-react';
import { createPortal } from 'react-dom';
import ViewToggle from '../../components/ViewToggle';
import FoodItem from '../../components/FoodItem';
import useMenuData from '../../hooks/useMenuData';
import useDebounce from '../../hooks/useDebounce';
import OptimizedImage from '../../components/OptimizedImage';

/**
 * Take Away Order Page
 * skips table selection entirely. orderType is fixed to 'takeaway'.
 */
const TakeAway = () => {
    const { user, formatPrice, settings, socket, socketConnected } = useContext(AuthContext);
    const navigate = useNavigate();

    // Redirect away if takeaway is disabled in settings
    useEffect(() => {
        if (settings && settings.takeawayEnabled === false) {
            navigate('/waiter', { replace: true });
        }
    }, [settings, navigate]);

    const orderType = 'takeaway';
    const [cart, setCart] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 250);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);
    const [viewMode, setViewMode] = useState(() => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        if (isMobile && settings?.mobileMenuView) return settings.mobileMenuView;
        return settings?.menuView || 'grid';
    });

    // ── Shared menu cache ────────────────────────────────────────────────
    const { menuItems, categories: rawCategories, loading } = useMenuData();

    // Sync with global settings
    useEffect(() => {
        const isMobile = window.innerWidth < 768;
        const defaultView = (isMobile && settings?.mobileMenuView)
            ? settings.mobileMenuView
            : (settings?.menuView || 'grid');
        if (settings?.enforceMenuView) {
            setViewMode(defaultView);
        } else if (!userInteracted && (settings?.menuView || settings?.mobileMenuView)) {
            setViewMode(defaultView);
        }
    }, [settings?.menuView, settings?.mobileMenuView, settings?.enforceMenuView, userInteracted]);

    const handleViewToggle = (newMode) => {
        setViewMode(newMode);
        setUserInteracted(true);
        localStorage.setItem('foodViewMode', newMode);
    };

    // ── Cart-specific socket sync (prices/removal when menu changes) ─────
    useEffect(() => {
        if (!socket) return;
        const onMenuUpdated = ({ action, item, id }) => {
            if (action === 'update' && item) {
                setCart(prev => prev.map(c =>
                    c._id === item._id
                        ? { ...c, name: item.name, price: c.variant ? c.variant.price : item.price }
                        : c
                ));
            } else if (action === 'delete' && id) {
                setCart(prev => prev.filter(c => c._id !== id));
            }
        };
        socket.on('menu-updated', onMenuUpdated);
        return () => socket.off('menu-updated', onMenuUpdated);
    }, [socket]);

    const addToCart = useCallback((item, variant = null) => {
        const cartKey = variant ? `${item._id}_${variant.name}` : item._id;
        const price = variant ? variant.price : item.price;
        setCart(prev => {
            const existing = prev.find(i => i.cartKey === cartKey);
            if (existing) return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...item, cartKey, price, variant: variant || null, quantity: 1, notes: '' }];
        });
    }, []);

    const updateQuantity = useCallback((cartKey, delta) => {
        setCart(prev => {
            const existing = prev.find(i => i.cartKey === cartKey);
            if (!existing) return prev;
            const newQty = existing.quantity + delta;
            if (newQty <= 0) return prev.filter(i => i.cartKey !== cartKey);
            return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: newQty } : i);
        });
    }, []);

    const handleItemAdd = (item, variant = null) => {
        if (!variant && item.variants?.length > 0) return;
        addToCart(item, variant);
    };

    const clearCart = () => { if (window.confirm('Clear all items?')) setCart([]); };

    // ── Deduplicated categories ──────────────────────────────────────────
    const categories = useMemo(() => {
        const seen = new Set();
        const result = [];
        [...rawCategories, ...menuItems.map(i => i.category).filter(Boolean)].forEach(cat => {
            if (!seen.has(cat._id)) {
                seen.add(cat._id);
                result.push(cat);
            }
        });
        return result;
    }, [rawCategories, menuItems]);

    const filteredItems = useMemo(() =>
        menuItems.filter(item =>
            (selectedCategory ? item.category?._id === selectedCategory : true) &&
            item.name.toLowerCase().includes(debouncedSearch.toLowerCase())
        ), [menuItems, selectedCategory, debouncedSearch]);

    // ── Pre-computed cart lookup — avoids O(n) filter on every item ──────
    const cartByItemId = useMemo(() => {
        const map = {};
        cart.forEach(i => {
            if (!map[i._id]) map[i._id] = [];
            map[i._id].push(i);
        });
        return map;
    }, [cart]);

    const totalAmount = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
    const sgst = settings?.sgst || 0;
    const cgst = settings?.cgst || 0;
    const sValue = totalAmount * (sgst / 100);
    const cValue = totalAmount * (cgst / 100);
    const finalAmount = totalAmount + sValue + cValue;

    const handleSubmitOrder = async () => {
        if (!socketConnected) {
            navigate('/connection');
            return;
        }
        if (!cart.length) return alert('Cart is empty!');

        const orderData = {
            orderType,
            tableId: null,
            items: cart.map(i => ({ menuItemId: i._id, name: i.name, price: i.price, quantity: i.quantity, notes: i.notes, variant: i.variant || null })),
            totalAmount, 
            sgst: sValue,
            cgst: cValue,
            finalAmount,
        };

        try {
            await api.post('/api/orders', orderData, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            navigate('/waiter', { replace: true });
        } catch (err) {
            alert('Order failed: ' + (err.response?.data?.message || 'Server Error'));
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[100dvh]">
            <div className="skeleton w-12 h-12 rounded-full" />
        </div>
    );

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden h-full min-h-0">
            <div className="flex flex-col md:flex-row flex-1 min-h-0 gap-5 animate-fade-in overflow-hidden">

                {/* Menu Panel */}
                <div className="flex-1 h-full min-h-0 flex flex-col min-w-0 bg-[var(--theme-bg-card)] rounded-3xl border border-[var(--theme-border)] shadow-2xl overflow-hidden">

                    {/* Top Bar */}
                    <div className="px-5 py-4 border-b border-[var(--theme-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                                onClick={() => navigate('/waiter', { replace: true })}
                                className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] bg-[var(--theme-bg-hover)] rounded-lg shrink-0"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="min-w-0">
                                <h2 className="hidden lg:flex text-sm md:text-lg font-black text-[var(--theme-text-main)] uppercase tracking-[0.05em] items-center gap-2 whitespace-nowrap">
                                    Takeaway Order
                                    <span className="hidden xs:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-black border border-blue-500/20 uppercase tracking-widest">
                                        Take Away
                                    </span>
                                </h2>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-1 max-w-xl">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search items..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl pl-10 pr-4 py-2 border border-[var(--theme-border)] focus:bg-[var(--theme-bg-hover)] focus:border-orange-500/30 focus:ring-4 focus:ring-orange-500/5 transition-all text-sm outline-none"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                        <SearchX size={14} />
                                    </button>
                                )}
                            </div>
                            {!settings?.enforceMenuView && <ViewToggle viewMode={viewMode} setViewMode={handleViewToggle} />}
                            <button
                                onClick={() => setIsCartOpen(!isCartOpen)}
                                className={`relative flex items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all font-black text-sm border shadow-sm shrink-0 active:scale-95
                                    ${isCartOpen
                                        ? 'bg-orange-500 text-white border-orange-600 shadow-md'
                                        : 'bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] border-[var(--theme-border)]'}
                                `}
                            >
                                <ShoppingCart size={18} className="shrink-0" />
                                {/* 3D animated double arrow */}
                                <span className={`flex items-center transition-transform duration-300 ${isCartOpen ? 'rotate-180' : ''}`} style={{ perspective: '120px' }}>
                                    <ChevronLeft size={14} className="animate-cart-arrow-1" strokeWidth={3} />
                                    <ChevronLeft size={14} className="animate-cart-arrow-2 -ml-2" strokeWidth={3} />
                                </span>
                                {cart.length > 0 && (
                                    <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${isCartOpen ? 'bg-white text-orange-600 border-orange-500' : 'bg-orange-600 text-white border-[var(--theme-bg-card)]'}`}>
                                        {cart.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        {/* Categories Selection — Optimized for Top Navigation View */}
                        <div className="flex flex-row overflow-x-auto smooth-scroll no-scrollbar bg-[var(--theme-bg-dark)] border-b border-[var(--theme-border)] flex-shrink-0 w-full">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`flex flex-shrink-0 flex-col items-center justify-center py-2.5 px-6 gap-1.5 transition-all border-b-4
                                    ${selectedCategory === null
                                        ? 'bg-orange-500/5 text-orange-600 border-orange-500 shadow-sm'
                                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] border-transparent'}`}
                            >
                                <Utensils size={14} className="mb-0.5" />
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">All</span>
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat._id}
                                    onClick={() => setSelectedCategory(cat._id)}
                                    className="flex flex-shrink-0 flex-col items-center justify-center py-2.5 px-6 gap-1 transition-all border-b-4 relative group"
                                    style={{
                                        backgroundColor: selectedCategory === cat._id ? `${cat.color || '#f97316'}15` : 'transparent',
                                        borderColor: selectedCategory === cat._id ? (cat.color || '#f97316') : 'transparent',
                                        color: selectedCategory === cat._id ? (cat.color || '#f97316') : 'var(--theme-text-muted)'
                                    }}
                                >
                                    <div
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-colors flex-shrink-0 shadow-sm"
                                        style={{
                                            backgroundColor: selectedCategory === cat._id ? (cat.color || '#1f2937') : 'var(--theme-bg-hover)',
                                            color: selectedCategory === cat._id ? 'white' : 'var(--theme-text-muted)'
                                        }}
                                    >
                                        {cat.name.charAt(0)}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-tighter text-center leading-tight whitespace-nowrap">{cat.name}</span>
                                </button>
                            ))}
                            {/* View All Button */}
                            <button
                                onClick={() => setIsCategoryModalOpen(true)}
                                className="flex flex-shrink-0 flex-col items-center justify-center py-2.5 px-6 gap-1.5 transition-all border-b-4 border-transparent text-orange-500 hover:bg-orange-500/5"
                            >
                                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-orange-500 text-white shadow-sm">
                                    <Grid size={10} strokeWidth={3} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">View All</span>
                            </button>
                        </div>

                        {/* Items Grid — Premium Independent Scroll UI */}
                        <div 
                            className="flex-1 h-full min-h-0 kot-scroll-premium p-2 md:p-3 xl:p-4 pb-40 animate-fade-in"
                            style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}
                        >
                            {filteredItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-[var(--theme-text-muted)]">
                                    <SearchX size={48} className="mb-4 opacity-10" />
                                    <p className="font-medium text-lg">No items found</p>
                                </div>
                            ) : (
                                <div className={`grid gap-2 md:gap-3 lg:gap-4 ${
                                    viewMode === 'list' 
                                        ? 'grid-cols-1' 
                                        : isCartOpen
                                            ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-2'
                                            : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                                }`}>
                                    {filteredItems.map(item => {
                                        const itemCartEntries = cartByItemId[item._id] || [];
                                        const itemCartQty = itemCartEntries.reduce((s, i) => s + i.quantity, 0);
                                        return (
                                            <FoodItem
                                                key={item._id}
                                                item={item}
                                                viewMode={viewMode}
                                                formatPrice={formatPrice}
                                                onAdd={handleItemAdd}
                                                onRemove={(key) => updateQuantity(key, -1)}
                                                cartQty={itemCartQty}
                                                itemCart={itemCartEntries}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cart Panel */}
                <aside className={`
                    fixed inset-0 z-[100] md:relative md:inset-auto md:z-0 flex-shrink-0 md:self-start
                    transition-all duration-300 ease-in-out overflow-hidden
                    ${isCartOpen
                        ? 'translate-x-0 w-full md:w-[320px] lg:w-[380px] xl:w-[420px]'
                        : 'translate-x-full md:translate-x-0 w-full md:w-0'
                    }
                `}>
                    {isCartOpen && <div onClick={() => setIsCartOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm md:hidden" />}


                    <div className="relative h-full md:h-auto md:max-h-[calc(100dvh-2rem)] w-full max-w-[400px] ml-auto md:ml-0 bg-[var(--theme-bg-card)] rounded-t-3xl md:rounded-3xl border-l md:border border-[var(--theme-border)] shadow-2xl flex flex-col pb-[64px] md:pb-0">

                        {/* Header */}
                        <div className="px-5 py-4 border-b border-[var(--theme-border)] flex items-center justify-between flex-shrink-0">
                            <div>
                                <h2 className="text-lg font-black text-[var(--theme-text-main)] flex items-center gap-2">
                                    <ShoppingCart size={18} className="text-blue-400" /> Current Cart
                                </h2>
                                <p className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-widest font-bold mt-0.5">
                                    Take Away • {cart.length} items
                                </p>
                            </div>
                            <button onClick={clearCart} className="p-2 text-[var(--theme-text-muted)] hover:text-rose-400 transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {/* Scrollable items */}
                        <div className="flex-1 kot-scroll px-4 py-4 space-y-3 custom-scrollbar">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-[var(--theme-text-muted)] py-10">
                                    <ShoppingCart size={64} className="mb-4 opacity-5" strokeWidth={1} />
                                    <p className="font-bold">Your cart is empty</p>
                                    <p className="text-xs">Add items from the menu to build your order</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.cartKey} className="flex items-center gap-3 animate-slide-up hover:bg-blue-500/5 p-1 -m-1 rounded-xl transition-colors group">
                                            <OptimizedImage 
                                                src={item.image} 
                                                alt={item.name} 
                                                width={100}
                                                containerClassName="w-10 h-10 rounded-lg flex-shrink-0 shadow-sm"
                                            />
                                        <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
                                            <div className="min-w-0 flex-1 pr-1">
                                                <h4 className="text-[12px] font-black text-[var(--theme-text-main)] truncate leading-tight uppercase tracking-tighter">{item.name}</h4>
                                                {item.variant && <p className="text-[8px] font-black text-blue-500 uppercase leading-none mt-0.5">{item.variant.name}</p>}
                                            </div>

                                            <div className="flex items-center shrink-0">
                                                <div className="flex items-center bg-[var(--theme-bg-dark)] rounded-full p-0.5 border border-[var(--theme-border)] shadow-inner">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartKey, -1); }}
                                                        className="w-6 h-6 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-blue-500 transition-all active:scale-75"
                                                    >
                                                        <Minus size={11} strokeWidth={3} />
                                                    </button>
                                                    <span className="w-5 text-center text-[10px] font-black text-[var(--theme-text-main)] tabular-nums">{item.quantity}</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartKey, 1); }}
                                                        className="w-6 h-6 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-blue-500 transition-all active:scale-75"
                                                    >
                                                        <Plus size={11} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>

                                            <span className="text-[12px] font-black text-blue-500 min-w-[50px] text-right tabular-nums tracking-tighter shrink-0">{formatPrice(item.price * item.quantity)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Sticky footer */}
                        <div className="flex-shrink-0 p-4 bg-[var(--theme-bg-dark)] border-t border-[var(--theme-border)] space-y-3">
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs text-[var(--theme-text-muted)]"><span>Subtotal</span><span>{formatPrice(totalAmount)}</span></div>
                                {sgst > 0 && <div className="flex justify-between text-xs text-[var(--theme-text-muted)]"><span>SGST ({sgst}%)</span><span>{formatPrice(totalAmount * sgst / 100)}</span></div>}
                                {cgst > 0 && <div className="flex justify-between text-xs text-[var(--theme-text-muted)]"><span>CGST ({cgst}%)</span><span>{formatPrice(totalAmount * cgst / 100)}</span></div>}
                                <div className="flex justify-between items-center pt-1.5 border-t border-[var(--theme-border)]">
                                    <span className="text-xs font-bold text-[var(--theme-text-main)] uppercase tracking-wider">Total</span>
                                    <span className="text-xl font-black text-blue-400">{formatPrice(finalAmount)}</span>
                                </div>
                            </div>

                            <button
                                onClick={handleSubmitOrder}
                                disabled={cart.length === 0}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                            >
                                Confirm & Place Order <ArrowRight size={16} />
                            </button>
                            <button className="md:hidden w-full py-2 text-[var(--theme-text-muted)] font-bold text-xs uppercase tracking-widest" onClick={() => setIsCartOpen(false)}>
                                Continue Adding Items
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            {/* ── Category Full View Modal ────────────────────────────────── */}
            {isCategoryModalOpen && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" 
                        onClick={() => setIsCategoryModalOpen(false)} 
                    />
                    <div className="relative w-full max-w-2xl bg-[var(--theme-bg-card)] rounded-[2.5rem] border border-[var(--theme-border)] shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-[var(--theme-border)] flex items-center justify-between bg-gradient-to-r from-[var(--theme-bg-hover)] to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                                    <Grid size={20} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-[var(--theme-text-main)] uppercase tracking-tight leading-none">All Categories</h2>
                                    <p className="text-[10px] font-bold text-[var(--theme-text-muted)] uppercase tracking-widest mt-1 opacity-60">
                                        Select a category to filter menu
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsCategoryModalOpen(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] hover:text-white hover:bg-red-500 transition-all active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search in Categories */}
                        <div className="p-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg-dark)]/30">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search categories..."
                                    className="w-full pl-10 pr-4 py-2 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20"
                                    onChange={(e) => {/* search logic */}}
                                />
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="flex-1 overflow-y-auto p-6 max-h-[60vh] custom-scrollbar">
                            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-4">
                                <button
                                    onClick={() => { setSelectedCategory(null); setIsCategoryModalOpen(false); }}
                                    className={`flex flex-col items-center gap-3 p-4 rounded-3xl border-2 transition-all group active:scale-95 ${selectedCategory === null ? 'border-orange-500 bg-orange-500/5' : 'border-[var(--theme-border)] hover:border-orange-500/30 bg-[var(--theme-bg-dark)]/50'}`}
                                >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${selectedCategory === null ? 'bg-orange-500 text-white' : 'bg-[var(--theme-bg-card)] text-gray-400'}`}>
                                        <Utensils size={24} />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-center leading-tight">All Items</span>
                                </button>

                                {categories.map(cat => (
                                    <button
                                        key={cat._id}
                                        onClick={() => { setSelectedCategory(cat._id); setIsCategoryModalOpen(false); }}
                                        className={`flex flex-col items-center gap-3 p-4 rounded-3xl border-2 transition-all group active:scale-95 ${selectedCategory === cat._id ? 'border-orange-500 bg-orange-500/5' : 'border-[var(--theme-border)] hover:border-orange-500/30 bg-[var(--theme-bg-dark)]/50'}`}
                                        style={{ 
                                            borderColor: selectedCategory === cat._id ? (cat.color || '#f97316') : '', 
                                            backgroundColor: selectedCategory === cat._id ? `${cat.color || '#f97316'}10` : '' 
                                        }}
                                    >
                                        {cat.image ? (
                                            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg transition-transform group-hover:scale-110 border border-white/10">
                                                <OptimizedImage src={cat.image} alt={cat.name} fill />
                                            </div>
                                        ) : (
                                            <div 
                                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-lg transition-transform group-hover:scale-110"
                                                style={{ backgroundColor: cat.color || '#3b82f6', color: 'white' }}
                                            >
                                                {cat.name.charAt(0)}
                                            </div>
                                        )}
                                        <span className={`text-[11px] font-black uppercase tracking-tight text-center leading-tight line-clamp-2 ${selectedCategory === cat._id ? 'text-[var(--theme-text-main)]' : 'text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text-main)]'}`}>
                                            {cat.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-[var(--theme-bg-dark)] border-t border-[var(--theme-border)] text-center">
                            <p className="text-[10px] text-[var(--theme-text-muted)] font-black uppercase tracking-widest opacity-40">
                                {categories.length} Categories Available
                            </p>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TakeAway;
