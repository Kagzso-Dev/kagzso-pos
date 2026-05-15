const mysql = require('../config/mysql');
const crypto = require('crypto');

const fmt = (row) => row ? {
    _id:         row.id,
    name:        row.name,
    description: row.description,
    color:       row.color,
    status:      row.status,
    image:       row.image || null,
    is_active:   row.is_active === 1,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
} : null;

const Category = {
    // Returns ALL categories regardless of status — for admin management
    async findAll() {
        const [rows] = await mysql.query('SELECT * FROM categories ORDER BY name ASC');
        return rows.map(fmt);
    },

    async findActive() {
        const [rows] = await mysql.query('SELECT * FROM categories WHERE is_active = 1 ORDER BY name ASC');
        return rows.map(fmt);
    },

    async findById(id) {
        try {
            const [rows] = await mysql.query('SELECT * FROM categories WHERE id = ? LIMIT 1', [id]);
            return fmt(rows[0]);
        } catch (error) {
            return null;
        }
    },

    async create({ name, description, color, image, is_active }) {
        const id = crypto.randomUUID();
        await mysql.query(
            'INSERT INTO categories (id, name, description, color, image, is_active, status) VALUES (?, ?, ?, ?, ?, ?, "active")',
            [id, name, description || null, color || '#f97316', image || null, is_active !== false ? 1 : 0]
        );
        return this.findById(id);
    },

    async updateById(id, updates) {
        const allowed = ['name', 'description', 'color', 'status', 'image', 'is_active'];
        const updateKeys = [];
        const updateValues = [];

        for (const [key, val] of Object.entries(updates)) {
            if (allowed.includes(key)) {
                updateKeys.push(`\`${key}\` = ?`);
                updateValues.push(val);
            }
        }

        if (updateKeys.length === 0) return this.findById(id);
        
        updateValues.push(id);
        const query = `UPDATE categories SET ${updateKeys.join(', ')} WHERE id = ?`;
        await mysql.query(query, updateValues);
        return this.findById(id);
    },

    async deleteById(id) {
        await mysql.query('DELETE FROM categories WHERE id = ?', [id]);
    },
};

module.exports = Category;
