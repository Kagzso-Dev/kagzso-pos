import { useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import { queueOrder } from '../../utils/syncEngine';
import {
    Search, ShoppingCart, ArrowLeft, ArrowRight,
    Utensils, ChevronRight, ChevronLeft, SearchX, Trash2, Plus, Minus, X,
    LayoutGrid
} from 'lucide-react';
import TableGrid from '../../components/TableGrid';
import ViewToggle from '../../components/ViewToggle';
import FoodItem from '../../components/FoodItem';
import useMenuData from '../../hooks/useMenuData';
import useDebounce from '../../hooks/useDebounce';
import OptimizedImage from '../../components/OptimizedImage';
import { calculateTax } from '../../utils/tax';

/**
 * Dine-In Order Page
 * Starts directly at table selection. orderType is fixed to 'dine-in'.
 */
const DineIn = () => {
    const { user, formatPrice, settings = {}, socket, socketConnected } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();

    // Redirect away if dine-in is disabled in settings
    useEffect(() => {
        if (settings?.dineInEnabled === false || settings?.dineInEnabled === 0) {
            navigate('/waiter', { replace: true });
        }
    }, [settings, navigate]);

    const queryParams = new URLSearchParams(location.search);
    const orderIdFromUrl = queryParams.get('orderId');

    const initialOrderId = location.state?.orderId || orderIdFromUrl;
    const [existingOrderId, setExistingOrderId] = useState(() => initialOrderId || localStorage.getItem('kagzso_active_dinein_orderId'));
    const [isAddingItems, setIsAddingItems] = useState(() => !!initialOrderId || localStorage.getItem('kagzso_active_dinein_isAdding') === 'true');
    const [step, setStep] = useState(() => {
        if (initialOrderId) return 3;
        const savedStep = localStorage.getItem('kagzso_active_dinein_step');
        return savedStep ? parseInt(savedStep) : 2;
    });
    const orderType = 'dine-in';
    const [selectedTable, setSelectedTable] = useState(() => {
        try {
            const saved = localStorage.getItem('kagzso_active_dinein_table');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });
    const [cart, setCart] = useState(() => {
        try {
            const saved = localStorage.getItem('kagzso_active_dinein_cart');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [existingItems, setExistingItems] = useState([]);
    const [originalTotal, setOriginalTotal] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderLoading, setOrderLoading] = useState(!!initialOrderId);
    const prevCartLength = useRef(0);

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
    const { menuItems, categories: rawCategories, loading: menuLoading } = useMenuData();

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

    // ── Persistence ───────────────────────────────────────────────────
    useEffect(() => {
        localStorage.setItem('kagzso_active_dinein_step', step);
        localStorage.setItem('kagzso_active_dinein_cart', JSON.stringify(cart));
        localStorage.setItem('kagzso_active_dinein_isAdding', isAddingItems);
        if (selectedTable) localStorage.setItem('kagzso_active_dinein_table', JSON.stringify(selectedTable));
        else localStorage.removeItem('kagzso_active_dinein_table');
        if (existingOrderId) localStorage.setItem('kagzso_active_dinein_orderId', existingOrderId);
        else localStorage.removeItem('kagzso_active_dinein_orderId');
    }, [step, cart, isAddingItems, selectedTable, existingOrderId]);

    const handleViewToggle = (newMode) => {
        setViewMode(newMode);
        setUserInteracted(true);
        localStorage.setItem('foodViewMode', newMode);
    };

    // ── Fetch existing order (when adding items to an order) ─────────────
    useEffect(() => {
        if (!isAddingItems || !existingOrderId) return;
        let mounted = true;
        setOrderLoading(true);
        api.get(`/api/orders/${existingOrderId}`)
            .then(res => {
                if (!mounted) return;
                const order = res.data;
                if (order) {
                    if (order.tableId) setSelectedTable(order.tableId);
                    setExistingItems(order.items || []);
                    setOriginalTotal(order.finalAmount || 0);
                }
            })
            .catch(err => console.error('DineIn: Failed to fetch existing order', err))
            .finally(() => { if (mounted) setOrderLoading(false); });
        return () => { mounted = false; };
    }, [isAddingItems, existingOrderId]);

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
            if (existing) {
                console.log('Cart updated: Quantity increased for', item.name);
                return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: existing.quantity + 1 } : i);
            }
            console.log('Cart updated: Item added -', item.name);
            return [...prev, { ...item, cartKey, price, variant: variant || null, quantity: 1, notes: '' }];
        });
    }, []);

    const resetOrderSession = useCallback(() => {
        console.log('Cart empty – clearing items but staying on menu');
        setCart([]);
        setExistingItems([]);
        setIsCartOpen(false);
        localStorage.removeItem('kagzso_active_dinein_cart');
    }, []);

    const updateQuantity = useCallback((cartKey, delta) => {
        setCart(prev => {
            const existing = prev.find(i => i.cartKey === cartKey);
            if (!existing) return prev;
            const newQty = existing.quantity + delta;
            
            if (newQty <= 0) {
                console.log('Item removed:', existing.name);
                const updated = prev.filter(i => i.cartKey !== cartKey);
                if (updated.length === 0) {
                    // This will be caught by the useEffect to trigger resetOrderSession
                }
                return updated;
            }
            console.log('Cart updated:', existing.name, 'quantity set to', newQty);
            return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: newQty } : i);
        });
    }, []);

    // Effect to handle full reset when cart becomes empty
    useEffect(() => {
        if (prevCartLength.current > 0 && cart.length === 0) {
            // User manually removed all items or cleared the cart
            if (step === 3) {
                resetOrderSession();
            }
        }
        prevCartLength.current = cart.length;
    }, [cart.length, step, resetOrderSession]);

    const handleItemAdd = (item, variant = null) => {
        if (!variant && item.variants?.length > 0) return;
        addToCart(item, variant);
    };

    const clearCart = () => { 
        if (window.confirm('Clear all items and reset order?')) {
            resetOrderSession();
        }
    };

    // ── Deduplicated categories (from API list + menu item categories) ───
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
    
    const prevSubtotal = originalTotal || 0;
    const combinedSubtotal = prevSubtotal + totalAmount;
    
    // Use centralized utility for estimation matching Backend
    const taxResults = calculateTax(combinedSubtotal, settings, { discount: 0 });
    const { sgst: sValue, cgst: cValue, finalAmount: finalAmount, sgstRate, cgstRate } = taxResults;

    const handleSubmitOrder = async () => {
        if (!socketConnected) {
            navigate('/connection');
            return;
        }
        if (!cart.length || isSubmitting) return;

        const tableId = isAddingItems
            ? (selectedTable?._id || selectedTable || null)
            : (selectedTable?._id || selectedTable);

        if (!isAddingItems && !tableId) return alert('Select a table!');

        setIsSubmitting(true);
        const orderData = {
            orderType,
            tableId,
            items: cart.map(i => ({ menuItemId: i._id, name: i.name, price: i.price, quantity: i.quantity, notes: i.notes, variant: i.variant || null })),
            totalAmount, 
            sgst: sValue,
            cgst: cValue,
            finalAmount,
        };

        try {
            if (isAddingItems && existingOrderId) {
                await api.post(`/api/orders/${existingOrderId}/add-items`, orderData, {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
            } else {
                await api.post('/api/orders', orderData, {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
            }
            navigate('/waiter', { replace: true });
        } catch (apiErr) {
            console.log('[DineIn] Order failed, queuing offline:', apiErr.message);
            const { localId, tokenNumber } = await queueOrder({
                tableId,
                type: orderType,
                items: orderData.items,
                totalAmount: orderData.totalAmount,
                sgst: orderData.sgst,
                cgst: orderData.cgst,
                finalAmount: orderData.finalAmount,
            });
            alert(`Order saved offline with token TK${tokenNumber}. Will sync when online.`);
            navigate('/waiter', { replace: true });
        } finally {
            setIsSubmitting(false);
        }
    };

    const loading = menuLoading || orderLoading;

    if (loading) return (
        <div className="flex items-center justify-center min-h-[100dvh]">
            <div className="skeleton w-12 h-12 rounded-full" />
        </div>
    );

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden h-full min-h-0">

            {/* ── STEP 2: TABLE SELECTION ─────────────────────────────── */}
            {step === 2 && (
                <div className="flex-1 flex flex-col animate-fade-in min-h-0">
                    <div className="flex items-center justify-between mb-6 px-2 shrink-0">
                        <div>
                            <h2 className="text-2xl font-black text-[var(--theme-text-main)]">Select a Table</h2>
                            <p className="text-[var(--theme-text-muted)] text-sm">Tap an available table to start the dine-in order</p>
                        </div>
                        <button
                            onClick={() => navigate('/waiter', { replace: true })}
                            className="p-3 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] rounded-xl transition-all"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    </div>
                    <div 
                        className="flex-1 bg-[var(--theme-bg-card)] rounded-3xl p-6 border border-[var(--theme-border)] shadow-2xl overflow-y-auto custom-scrollbar min-h-0"
                        style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}
                    >
                        <TableGrid
                            allowedStatuses={['available']}
                            filterByAllowedStatuses={false}
                            showCleanAction={true}
                            onSelectTable={(table) => {
                                setSelectedTable(table);
                                setStep(3);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* ── STEP 3: MENU + CART ─────────────────────────────────── */}
            {step === 3 && (
                <div className="flex flex-col md:flex-row flex-1 min-h-0 gap-5 animate-fade-in overflow-hidden">

                    {/* Menu Panel */}
                    <div className="flex-1 h-full min-h-0 flex flex-col min-w-0 bg-[var(--theme-bg-card)] rounded-3xl border border-[var(--theme-border)] shadow-2xl overflow-hidden">

                        <div className="px-4 py-3 border-b border-[var(--theme-border)] flex items-center gap-4 flex-shrink-0 bg-[var(--theme-bg-card)] shadow-sm">
                            <button 
                                onClick={() => navigate('/waiter', { replace: true })} 
                                className="w-10 h-10 flex items-center justify-center bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] rounded-xl border border-[var(--theme-border)] shadow-sm active:scale-95 transition-all shrink-0"
                            >
                                <ArrowLeft size={18} />
                            </button>

                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)] group-focus-within:text-orange-500 transition-colors" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search menu..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl pl-9 pr-4 py-2 border border-[var(--theme-border)] focus:bg-[var(--theme-bg-hover)] focus:border-orange-500/30 transition-all text-sm h-10 outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {!settings?.enforceMenuView && <ViewToggle viewMode={viewMode} setViewMode={handleViewToggle} />}
                                
                                {cart.length > 0 && (
                                    <button
                                        onClick={() => setIsCartOpen(!isCartOpen)}
                                        className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all border shadow-sm active:scale-95 shrink-0 ${isCartOpen ? 'bg-orange-500 text-white border-orange-600 shadow-orange-500/20' : 'bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] border-[var(--theme-border)]'}`}
                                    >
                                        <ShoppingCart size={18} />
                                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black bg-orange-600 text-white border-2 border-[var(--theme-bg-card)] shadow-lg">
                                            {cart.length}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
                            {/* Categories Selection — Optimized for Horizontal Scroll Swipe */}
                            <div className="flex flex-row flex-nowrap overflow-x-auto no-scrollbar snap-x snap-mandatory bg-[var(--theme-bg-dark)]/50 border-b border-[var(--theme-border)] flex-shrink-0 w-full scroll-smooth">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`flex flex-shrink-0 snap-start flex-col items-center justify-center py-2.5 px-8 min-w-[80px] gap-1 transition-all border-b-4
                                        ${selectedCategory === null
                                            ? 'bg-orange-500/5 text-orange-600 border-orange-500 shadow-sm'
                                            : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] border-transparent'}`}
                                >
                                    <Utensils size={14} className={selectedCategory === null ? 'scale-110' : ''} />
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">All</span>
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat._id}
                                        onClick={() => setSelectedCategory(cat._id)}
                                        className="flex flex-shrink-0 snap-start flex-col items-center justify-center py-2.5 px-8 min-w-[100px] gap-1.5 transition-all border-b-4 relative group"
                                        style={{
                                            backgroundColor: selectedCategory === cat._id ? `${cat.color || '#f97316'}15` : 'transparent',
                                            borderColor: selectedCategory === cat._id ? (cat.color || '#f97316') : 'transparent',
                                            color: selectedCategory === cat._id ? (cat.color || '#f97316') : 'var(--theme-text-muted)'
                                        }}
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-all flex-shrink-0 shadow-sm"
                                            style={{
                                                backgroundColor: selectedCategory === cat._id ? (cat.color || '#f97316') : 'var(--theme-bg-hover)',
                                                color: selectedCategory === cat._id ? 'white' : 'var(--theme-text-muted)',
                                                transform: selectedCategory === cat._id ? 'scale(1.15)' : 'scale(1)'
                                            }}
                                        >
                                            {cat.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-tighter text-center leading-tight whitespace-nowrap">{cat.name}</span>
                                        {selectedCategory === cat._id && <div className="absolute inset-x-0 bottom-0 h-full bg-current/5 animate-fade-in pointer-events-none" />}
                                    </button>
                                ))}
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
                                    <div className={`grid gap-2 md:gap-3 xl:gap-4 ${
                                        viewMode === 'list' 
                                            ? 'grid-cols-1' 
                                            : isCartOpen
                                                ? 'grid-cols-2 md:grid-cols-1 lg:grid-cols-2'
                                                : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
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

                    {/* Cart Side Panel — Optimized Tablet Width */}
                    <aside 
                        className={`
                            fixed z-[100] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform flex flex-col
                            md:relative md:z-0 md:translate-x-0 border-[var(--theme-border)]
                            ${(isCartOpen && cart.length > 0) 
                                ? 'translate-x-0 opacity-100 shadow-2xl ring-1 ring-black/5 ' +
                                  'inset-y-0 right-0 w-[90vw] ' +
                                  'sm:inset-y-4 sm:right-4 sm:w-[400px] sm:rounded-[3rem] ' +
                                  'md:inset-y-0 md:right-0 md:w-[320px] lg:w-[380px] xl:w-[420px] md:rounded-3xl md:border-l'
                                : 'translate-x-full opacity-0 w-0 md:w-0 overflow-hidden'
                            }
                            bg-[var(--theme-bg-card)]
                        `}
                    >
                        {(isCartOpen && cart.length > 0) && <div onClick={() => setIsCartOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm md:hidden" />}

                        <div className="relative h-full w-full bg-[var(--theme-bg-card)] flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="px-5 py-4 border-b border-[var(--theme-border)] flex items-center justify-between flex-shrink-0 bg-[var(--theme-bg-card)]">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setIsCartOpen(false)} 
                                        className="md:hidden w-10 h-10 flex items-center justify-center bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] rounded-xl hover:bg-[var(--theme-bg-hover)] transition-all border border-[var(--theme-border)]"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <div>
                                        <h2 className="text-lg font-black text-[var(--theme-text-main)] flex items-center gap-2">
                                            <ShoppingCart size={18} className="text-orange-500" /> Current Cart
                                        </h2>
                                        <p className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-widest font-bold mt-0.5">
                                            {isAddingItems ? 'Adding to Existing' : 'Dine-In'} • {cart.length} items
                                        </p>
                                    </div>
                                </div>
                                <button onClick={clearCart} className="p-2 text-[var(--theme-text-muted)] hover:text-rose-400 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {/* Scrollable items / Empty State */}
                            <div className="flex-1 kot-scroll min-h-0 flex flex-col">
                                {cart.length === 0 && (!isAddingItems || existingItems.length === 0) ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 animate-fade-in">
                                        <div className="w-24 h-24 rounded-full bg-[var(--theme-bg-dark)] flex items-center justify-center mb-6 border border-[var(--theme-border)] shadow-inner">
                                            <ShoppingCart size={32} className="text-[var(--theme-text-muted)] opacity-20" />
                                        </div>
                                        <h3 className="text-lg font-black text-[var(--theme-text-main)] uppercase tracking-tight mb-2">Your cart is empty</h3>
                                        <p className="text-xs text-[var(--theme-text-muted)] max-w-[200px] font-bold leading-relaxed opacity-60">
                                            Add some delicious items from the menu to start your order
                                        </p>
                                    </div>
                                ) : (
                                    <div className="px-4 py-4 space-y-4">
                                        {isAddingItems && existingItems.filter(item => item.status !== 'CANCELLED').length > 0 && (
                                            <div className="space-y-2 opacity-60">
                                                {existingItems.filter(item => item.status !== 'CANCELLED').map((item, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-[10px] font-bold text-[var(--theme-text-muted)] uppercase tracking-tight py-1 border-b border-[var(--theme-border)]/30">
                                                        <div className="flex items-center gap-2">
                                                            <span>{item.quantity}x</span>
                                                            <span className="truncate max-w-[120px]">{item.name}</span>
                                                        </div>
                                                        <span>{formatPrice(item.price * item.quantity)}</span>
                                                    </div>
                                                ))}
                                                <div className="py-2 text-center">
                                                    <span className="bg-orange-500/10 text-orange-600 text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-orange-500/20">
                                                        NEW ITEMS TO ADD
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {cart.map(item => (
                                            <div key={item.cartKey} className="flex items-start gap-4 animate-slide-up hover:bg-orange-500/5 p-2 -m-1 rounded-2xl transition-all group border border-transparent hover:border-[var(--theme-border)]/50">
                                                <OptimizedImage 
                                                    src={item.image} 
                                                    alt={item.name} 
                                                    width={100}
                                                    containerClassName="w-12 h-12 rounded-xl flex-shrink-0 shadow-lg border border-[var(--theme-border)]/30 overflow-hidden"
                                                />
                                                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="text-[13px] font-medium text-[var(--theme-text-main)] line-clamp-2 leading-tight uppercase tracking-tight group-hover:text-orange-500 transition-colors">
                                                                {item.name}
                                                            </h4>
                                                            {item.variant && (
                                                                <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mt-1 bg-orange-500/10 px-1.5 py-0.5 rounded-md inline-block">
                                                                    {item.variant.name}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className="text-[13px] font-black text-orange-500 tabular-nums tracking-tighter shrink-0">
                                                            {formatPrice(item.price * item.quantity)}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-1">
                                                        <div className="flex items-center bg-[var(--theme-bg-dark)] rounded-xl p-0.5 border border-[var(--theme-border)] shadow-inner">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartKey, -1); }}
                                                                className="w-7 h-7 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-all active:scale-75"
                                                            >
                                                                <Minus size={12} strokeWidth={3} />
                                                            </button>
                                                            <span className="w-8 text-center text-[11px] font-black text-[var(--theme-text-main)] tabular-nums">{item.quantity}</span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartKey, 1); }}
                                                                className="w-7 h-7 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-all active:scale-75"
                                                            >
                                                                <Plus size={12} strokeWidth={3} />
                                                            </button>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-[var(--theme-text-muted)] uppercase tracking-widest opacity-40">
                                                            {formatPrice(item.price)} ea
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Sticky footer — only visible when cart has items */}
                            {(cart.length > 0 || isAddingItems && existingItems.length > 0) && (
                                <div className="flex-shrink-0 p-4 bg-[var(--theme-bg-dark)] border-t border-[var(--theme-border)] space-y-3">
                                    <div className="space-y-1.5">
                                        {isAddingItems ? (
                                            (() => {
                                                const existingItemsActive = existingItems.filter(i => i.status !== 'CANCELLED');
                                                const existingSubtotal = existingItemsActive.reduce((s, i) => s + (i.price * i.quantity), 0);
                                                const combinedSubtotal = existingSubtotal + totalAmount;
                                                
                                                const taxResults = calculateTax(combinedSubtotal, settings, { discount: 0 });
                                                const { sgst: combinedSgst, cgst: combinedCgst, finalAmount: combinedFinal, sgstRate, cgstRate } = taxResults;

                                                return (
                                                    <>
                                                        <div className="flex justify-between text-[11px] font-bold text-[var(--theme-text-main)] uppercase tracking-wide">
                                                            <span>New Subtotal (All Items)</span>
                                                            <span>{formatPrice(combinedSubtotal)}</span>
                                                        </div>
                                                        {sgstRate > 0 && (
                                                            <div className="flex justify-between text-[10px] font-bold text-[var(--theme-text-muted)]">
                                                                <span>Combined SGST ({sgstRate}%)</span>
                                                                <span>{formatPrice(combinedSgst)}</span>
                                                            </div>
                                                        )}
                                                        {cgstRate > 0 && (
                                                            <div className="flex justify-between text-[10px] font-bold text-[var(--theme-text-muted)]">
                                                                <span>Combined CGST ({cgstRate}%)</span>
                                                                <span>{formatPrice(combinedCgst)}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between items-center pt-2 border-t-2 border-dashed border-[var(--theme-border)]">
                                                            <div>
                                                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] block leading-none">NEW TOTAL ESTIMATE</span>
                                                                <span className="text-[10px] font-bold text-[var(--theme-text-muted)] italic">Includes {existingItemsActive.length} old + {cart.length} new</span>
                                                            </div>
                                                            <span className="text-2xl font-black text-orange-500 tabular-nums">
                                                                {formatPrice(combinedFinal)}
                                                            </span>
                                                        </div>
                                                    </>
                                                );
                                            })()
                                        ) : cart.length > 0 ? (
                                            <>
                                                <div className="flex justify-between text-xs text-[var(--theme-text-muted)]"><span>Subtotal</span><span>{formatPrice(totalAmount)}</span></div>
                                                {sgstRate > 0 && <div className="flex justify-between text-xs text-[var(--theme-text-muted)]"><span>SGST ({sgstRate}%)</span><span>{formatPrice(totalAmount * sgstRate / 100)}</span></div>}
                                                {cgstRate > 0 && <div className="flex justify-between text-xs text-[var(--theme-text-muted)]"><span>CGST ({cgstRate}%)</span><span>{formatPrice(totalAmount * cgstRate / 100)}</span></div>}
                                                <div className="flex justify-between items-center pt-1.5 border-t border-[var(--theme-border)]">
                                                    <span className="text-xs font-bold text-[var(--theme-text-main)] uppercase tracking-wider">Total</span>
                                                    <span className="text-xl font-black text-orange-500">{formatPrice(finalAmount)}</span>
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                    
                                    {cart.length > 0 && (
                                        <button
                                            onClick={handleSubmitOrder}
                                            className={`w-full py-3.5 text-white font-black rounded-2xl shadow-glow-orange transition-all active:scale-95 flex items-center justify-center gap-2 text-sm ${isAddingItems ? 'bg-orange-600 hover:bg-orange-500 shadow-[0_10px_30px_rgba(249,115,22,0.3)]' : 'bg-orange-600 hover:bg-orange-500'}`}
                                        >
                                            {isAddingItems ? `Add to Order ORD-${existingOrderId.slice(-4).toUpperCase()}` : 'Confirm & Place Order'} <ArrowRight size={16} />
                                        </button>
                                    )}
                                    
                                    <button className="md:hidden w-full py-2 text-[var(--theme-text-muted)] font-bold text-xs uppercase tracking-widest" onClick={() => setIsCartOpen(false)}>
                                        Continue Adding Items
                                    </button>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            )}

            {/* ── Mobile Floating Cart Bar ── */}
            {step === 3 && cart.length > 0 && !isCartOpen && (
                <div className="md:hidden fixed bottom-6 left-4 right-4 z-[90] animate-in slide-in-from-bottom-10 fade-in duration-500">
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="w-full h-14 bg-gray-900 text-white rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.3)] flex items-center justify-between px-5 active:scale-[0.98] transition-all overflow-hidden relative group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <ShoppingCart size={20} className="text-orange-500" />
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-600 rounded-full flex items-center justify-center text-[9px] font-black border border-gray-900">
                                    {cart.length}
                                </span>
                            </div>
                            <div className="flex flex-col items-start leading-tight">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">View Cart</span>
                                <span className="text-sm font-black">{formatPrice(finalAmount)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-[0.1em]">Place Order</span>
                            <ChevronRight size={16} strokeWidth={3} className="text-orange-500" />
                        </div>
                        {/* Animated gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    </button>
                </div>
            )}

        </div>
    );
};


export default DineIn;
