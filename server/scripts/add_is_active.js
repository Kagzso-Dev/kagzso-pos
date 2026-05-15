require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('../config/mysql');

async function addIsActive() {
    try {
        console.log('--- ADDING IS_ACTIVE COLUMNS ---');

        // 1. Categories
        const [catCols] = await mysql.query('SHOW COLUMNS FROM categories LIKE "is_active"');
        if (catCols.length === 0) {
            console.log('Adding is_active to categories...');
            await mysql.query('ALTER TABLE categories ADD COLUMN is_active TINYINT(1) DEFAULT 1');
        } else {
            console.log('is_active already exists in categories');
        }

        // 2. Menu Items
        const [menuCols] = await mysql.query('SHOW COLUMNS FROM menu_items LIKE "is_active"');
        if (menuCols.length === 0) {
            console.log('Adding is_active to menu_items...');
            await mysql.query('ALTER TABLE menu_items ADD COLUMN is_active TINYINT(1) DEFAULT 1');
        } else {
            console.log('is_active already exists in menu_items');
        }

        console.log('--- MIGRATION SUCCESSFUL ---');
    } catch (err) {
        console.error('--- MIGRATION FAILED ---');
        console.error(err.message);
    } finally {
        process.exit(0);
    }
}

addIsActive();
