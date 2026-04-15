const Category = require('../models/Category');
const { invalidateCache } = require('../utils/cache');

// @desc    Get categories
// @route   GET /api/categories
// @access  Private
const getCategories = async (req, res) => {
    try {
        const categories = await Category.findAll();
        console.log(`[API] Categories fetched: ${categories.length} items`);
        res.json(categories);
    } catch (error) {
        console.error('[API] Error fetching categories:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create category
// @route   POST /api/categories
// @access  Private (Admin)
const createCategory = async (req, res) => {
    const { name, description, color, image } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Category name is required' });
    }
    try {
        const category = await Category.create({ name: name.trim(), description, color, image });
        invalidateCache('categories');
        invalidateCache('menu');
        req.app.get('io').to('restaurant_main').emit('category-updated', { action: 'create', category });
        res.status(201).json(category);
    } catch (error) {
        // Standard unique constraint error check
        if (error.code === 409 || error.message?.includes('already exists')) {
            return res.status(409).json({ message: `Category "${name.trim()}" already exists` });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (Admin)
const updateCategory = async (req, res) => {
    try {
        const existing = await Category.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ message: 'Category not found' });
        }
        const category = await Category.updateById(req.params.id, req.body);
        invalidateCache('categories');
        invalidateCache('menu');
        req.app.get('io').to('restaurant_main').emit('category-updated', { action: 'update', category });
        res.json(category);
    } catch (error) {
        if (error.code === 409 || error.message?.includes('already exists')) {
            return res.status(409).json({ message: 'A category with that name already exists' });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
const deleteCategory = async (req, res) => {
    try {
        const existing = await Category.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ message: 'Category not found' });
        }
        await Category.deleteById(req.params.id);
        invalidateCache('categories');
        invalidateCache('menu');
        req.app.get('io').to('restaurant_main').emit('category-updated', { action: 'delete', id: req.params.id });
        res.json({ message: 'Category removed' });
    } catch (error) {
        // Manual check for related records (e.g. menu items) before deleting.
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
