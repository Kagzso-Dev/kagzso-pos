const mysql = require('../config/mysql');
const crypto = require('crypto');

const fmt = (row, catDoc = null) => {
    if (!row) return null;
    return {
        _id: row.id,
        name: row.name,
        description: row.description,
        price: parseFloat(row.price),
        category: catDoc 
            ? { _id: catDoc.id, name: catDoc.name, color: catDoc.color, status: catDoc.status, is_active: catDoc.is_active === 1 }
            : row.category_id,
        image: row.image,
        availability: row.availability === 1,
        is_active: row.is_active === 1,
        isVeg: row.is_veg === 1,
        variants: row.variants ? (typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const MenuItem = {
    async findAll() {
        const [itemsResp] = await mysql.query('SELECT * FROM menu_items ORDER BY name ASC');
        const [catsResp] = await mysql.query('SELECT * FROM categories');
        
        const catMap = {};
        catsResp.forEach(c => catMap[c.id] = c);
        
        return itemsResp.map(item => fmt(item, catMap[item.category_id]));
    },

    async findAvailable() {
        const query = `
            SELECT m.* 
            FROM menu_items m
            JOIN categories c ON m.category_id = c.id
            WHERE m.is_active = 1 
              AND m.availability = 1
              AND c.is_active = 1
            ORDER BY m.name ASC
        `;
        const [itemsResp] = await mysql.query(query);
        const [catsResp] = await mysql.query('SELECT * FROM categories');
        
        const catMap = {};
        catsResp.forEach(c => catMap[c.id] = c);
        
        return itemsResp.map(item => fmt(item, catMap[item.category_id]));
    },

    async findById(id) {
        try {
            const [items] = await mysql.query('SELECT * FROM menu_items WHERE id = ? LIMIT 1', [id]);
            const item = items[0];
            if (!item) return null;
            
            let catDoc = null;
            if (item.category_id) {
                const [cats] = await mysql.query('SELECT * FROM categories WHERE id = ? LIMIT 1', [item.category_id]);
                catDoc = cats[0];
            }
            return fmt(item, catDoc);
        } catch (error) {
            return null;
        }
    },

    async create({ name, description, price, category, image, isVeg, availability, is_active, variants }) {
        const id = crypto.randomUUID();
        await mysql.query(
            'INSERT INTO menu_items (id, name, description, price, category_id, image, availability, is_active, is_veg, variants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, name, description || null, parseFloat(price), category, image || null, availability !== false ? 1 : 0, is_active !== false ? 1 : 0, isVeg !== false ? 1 : 0, variants?.length ? JSON.stringify(variants) : null]
        );
        return this.findById(id);
    },

    async updateById(id, updates) {
        const fieldMap = {
            name: 'name',
            description: 'description',
            price: 'price',
            category: 'category_id',
            image: 'image',
            availability: 'availability',
            is_active: 'is_active',
            isVeg: 'is_veg',
            variants: 'variants',
        };
        const updateKeys = [];
        const updateValues = [];

        for (const [key, val] of Object.entries(updates)) {
            if (key in fieldMap) {
                const col = fieldMap[key];
                if (col === 'price' && val !== undefined) {
                    updateValues.push(parseFloat(val));
                } else if (key === 'variants' && val !== undefined) {
                    updateValues.push(val?.length ? JSON.stringify(val) : null);
                } else if (key === 'availability' || key === 'isVeg' || key === 'is_active') {
                    updateValues.push(val ? 1 : 0);
                } else {
                    updateValues.push(val);
                }
                updateKeys.push(`\`${col}\` = ?`);
            }
        }

        if (updateKeys.length === 0) return this.findById(id);
        
        updateValues.push(id);
        const query = `UPDATE menu_items SET ${updateKeys.join(', ')} WHERE id = ?`;
        await mysql.query(query, updateValues);
        return this.findById(id);
    },

    async deleteById(id) {
        await mysql.query('DELETE FROM menu_items WHERE id = ?', [id]);
    },
};

module.exports = MenuItem;
