import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import { saveMenus, getMenus, saveCategories, getCategories } from '../db/db';

const DEFAULT_CATEGORY_IMAGES = {
    'Starters': '/images/starters.png',
    'Main Course': '/images/main-course.png',
    'Beverages': '/images/beverages.png',
};
const DEFAULT_FOOD_IMAGE = '/images/main-course.png';

const CACHE_TTL = 5 * 60 * 1000;
let _cache = {
    items: null,
    categories: null,
    fetchedAt: 0,
};
let _pendingFetch = null;

const applyDefaultImages = (items) => {
    return items.map(item => {
        if (!item.image || item.image.trim() === '') {
            const catName = item.category?.name?.trim() || '';
            item.image = DEFAULT_CATEGORY_IMAGES[catName] || DEFAULT_FOOD_IMAGE;
        }
        return item;
    });
};

const useMenuData = () => {
    const { socket } = useContext(AuthContext);

    const isCacheFresh =
        _cache.items !== null && Date.now() - _cache.fetchedAt < CACHE_TTL;

    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(!isCacheFresh);

    const loadFromIndexedDB = async () => {
        const [cachedItems, cachedCategories] = await Promise.all([
            getMenus(),
            getCategories(),
        ]);
        if (cachedItems.length > 0) {
            _cache.items = applyDefaultImages(cachedItems);
            _cache.categories = cachedCategories;
            _cache.fetchedAt = Date.now();
            setMenuItems([..._cache.items]);
            setCategories([..._cache.categories]);
            return true;
        }
        return false;
    };

    useEffect(() => {
        const init = async () => {
            if (isCacheFresh) {
                setMenuItems([...(_cache.items || [])]);
                setCategories([...(_cache.categories || [])]);
                setLoading(false);
                return;
            }

            if (navigator.onLine) {
                let mounted = true;
                if (!_pendingFetch) {
                    _pendingFetch = Promise.all([
                        api.get('/api/menu'),
                        api.get('/api/categories'),
                    ])
                        .then(([menuRes, catRes]) => {
                            console.log('useMenuData: API Response - Menu:', menuRes.data);
                            console.log('useMenuData: API Response - Categories:', catRes.data);

                            const items = applyDefaultImages(menuRes.data || []);
                            const cats = catRes.data || [];
                            
                            if (cats.length === 0) {
                                console.warn('useMenuData: No categories returned from API.');
                            }

                            _cache.items = items;
                            _cache.categories = cats;
                            _cache.fetchedAt = Date.now();

                            saveMenus(items);
                            saveCategories(cats);
                        })
                        .catch(err => {
                            console.error('useMenuData: API Error:', err);
                            // Optionally fallback to local DB if API fails
                            loadFromIndexedDB();
                        })
                        .finally(() => {
                            _pendingFetch = null;
                        });
                }

                _pendingFetch.then(() => {
                    if (!mounted) return;
                    setMenuItems([...(_cache.items || [])]);
                    setCategories([...(_cache.categories || [])]);
                    setLoading(false);
                });
            } else {
                const hasLocal = await loadFromIndexedDB();
                if (!hasLocal) {
                    _cache.items = [];
                    _cache.categories = [];
                }
                setLoading(false);
            }
        };

        init();
    }, [isCacheFresh]);

    useEffect(() => {
        if (!socket) return;

        const onMenuUpdated = ({ action, item, id }) => {
            if (action === 'create' && item) {
                const processed = applyDefaultImages([item])[0];
                setMenuItems(prev => {
                    if (prev.find(i => i._id === item._id)) return prev;
                    const next = [...prev, processed];
                    _cache.items = next;
                    saveMenus(next);
                    return next;
                });
            } else if (action === 'update' && item) {
                const processed = applyDefaultImages([item])[0];
                setMenuItems(prev => {
                    let next;
                    if (!item.availability) {
                        next = prev.filter(i => i._id !== item._id);
                    } else {
                        next = prev.map(i => (i._id === item._id ? processed : i));
                    }
                    _cache.items = next;
                    saveMenus(next);
                    return next;
                });
            } else if (action === 'delete' && id) {
                setMenuItems(prev => {
                    const next = prev.filter(i => i._id !== id);
                    _cache.items = next;
                    saveMenus(next);
                    return next;
                });
            }
        };

        const onCategoryUpdated = ({ action, category, id }) => {
            if (action === 'create' && category) {
                setCategories(prev => {
                    if (prev.find(c => c._id === category._id)) return prev;
                    const next = [...prev, category];
                    _cache.categories = next;
                    saveCategories(next);
                    return next;
                });
            } else if (action === 'update' && category) {
                setCategories(prev => {
                    const next = prev.map(c =>
                        c._id === category._id ? category : c
                    );
                    _cache.categories = next;
                    saveCategories(next);
                    return next;
                });
            } else if (action === 'delete' && id) {
                setCategories(prev => {
                    const next = prev.filter(c => c._id !== id);
                    _cache.categories = next;
                    saveCategories(next);
                    return next;
                });
            }
        };

        socket.on('menu-updated', onMenuUpdated);
        socket.on('category-updated', onCategoryUpdated);
        return () => {
            socket.off('menu-updated', onMenuUpdated);
            socket.off('category-updated', onCategoryUpdated);
        };
    }, [socket]);

    return { menuItems, categories, loading };
};

export default useMenuData;