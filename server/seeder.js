/**
 * MySQL Seeder with Full Menu & Images
 */
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
dotenv.config();

const mysql = require('./config/mysql');

const hash = async (pw) => bcrypt.hash(pw, await bcrypt.genSalt(10));

const createTables = async () => {
    console.log('--- INITIALIZING DATABASE ---');
    
    // Create database if it doesn't exist
    const dbName = process.env.MYSQL_DATABASE || 'kagzso_kot_seed';
    await mysql.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await mysql.query(`USE \`${dbName}\``);
    
    console.log(`Ensuring tables exist in ${dbName}...`);
    
    // Order matters for drops due to FKs
    const tablesToDrop = [
        'payment_audits', 'payments', 'daily_analytics', 'order_items', 
        'orders', 'menu_items', 'categories', 'tables', 'settings', 'users', 'counters'
    ];

    await mysql.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of tablesToDrop) {
        await mysql.query(`DROP TABLE IF EXISTS \`${t}\``);
    }
    await mysql.query('SET FOREIGN_KEY_CHECKS = 1');

    const queries = [
        `CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(36) PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            role VARCHAR(50) NOT NULL,
            image TEXT,
            is_verified BOOLEAN DEFAULT 0,
            last_login_at DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS categories (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            color VARCHAR(7),
            status VARCHAR(50) DEFAULT 'active',
            is_active BOOLEAN DEFAULT 1,
            image TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS menu_items (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            category_id VARCHAR(36),
            image TEXT,
            availability BOOLEAN DEFAULT 1,
            is_active BOOLEAN DEFAULT 1,
            is_veg BOOLEAN DEFAULT 0,
            variants JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS tables (
            id VARCHAR(36) PRIMARY KEY,
            number VARCHAR(50) NOT NULL UNIQUE,
            capacity INT DEFAULT 4,
            status VARCHAR(50) DEFAULT 'available',
            current_order_id VARCHAR(36),
            reserved_at DATETIME,
            locked_by VARCHAR(255),
            reservation_expires_at DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS orders (
            id VARCHAR(36) PRIMARY KEY,
            order_number VARCHAR(50) UNIQUE,
            token_number INT,
            order_type VARCHAR(50) DEFAULT 'dine-in',
            table_id VARCHAR(36),
            customer_name VARCHAR(255),
            customer_phone VARCHAR(20),
            order_status VARCHAR(50) DEFAULT 'pending',
            payment_status VARCHAR(50) DEFAULT 'unpaid',
            payment_method VARCHAR(50),
            kot_status VARCHAR(50) DEFAULT 'Open',
            total_amount DECIMAL(10,2),
            sgst DECIMAL(10,2) DEFAULT 0,
            cgst DECIMAL(10,2) DEFAULT 0,
            discount DECIMAL(10,2) DEFAULT 0,
            discount_label VARCHAR(255),
            final_amount DECIMAL(10,2),
            waiter_id VARCHAR(36),
            prep_started_at DATETIME,
            is_partially_ready BOOLEAN DEFAULT 0,
            ready_at DATETIME,
            completed_at DATETIME,
            payment_at DATETIME,
            paid_at DATETIME,
            cancelled_by VARCHAR(50),
            cancel_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS order_items (
            id VARCHAR(36) PRIMARY KEY,
            order_id VARCHAR(36) NOT NULL,
            menu_item_id VARCHAR(36),
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            quantity INT NOT NULL,
            notes TEXT,
            variant JSON,
            status VARCHAR(50) DEFAULT 'PENDING',
            cancelled_at DATETIME,
            cancelled_by VARCHAR(50),
            cancel_reason TEXT,
            is_newly_added BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS counters (
            counter_key VARCHAR(100) PRIMARY KEY,
            sequence_value INT DEFAULT 0
        )`,
        `CREATE TABLE IF NOT EXISTS settings (
            id INT PRIMARY KEY AUTO_INCREMENT,
            restaurant_name VARCHAR(255),
            address TEXT,
            currency VARCHAR(10) DEFAULT 'INR',
            currency_symbol VARCHAR(5) DEFAULT '₹',
            tax_rate DECIMAL(5,2) DEFAULT 0,
            sgst DECIMAL(5,2) DEFAULT 2.5,
            cgst DECIMAL(5,2) DEFAULT 2.5,
            gst_number VARCHAR(50),
            pending_color VARCHAR(7) DEFAULT '#fcb336',
            accepted_color VARCHAR(7) DEFAULT '#8b5cf6',
            preparing_color VARCHAR(7) DEFAULT '#f59e0b',
            ready_color VARCHAR(7) DEFAULT '#10b981',
            payment_color VARCHAR(7) DEFAULT '#140731',
            dashboard_view VARCHAR(50) DEFAULT 'all',
            menu_view VARCHAR(50) DEFAULT 'grid',
            mobile_menu_view VARCHAR(50) DEFAULT 'grid',
            dine_in_enabled BOOLEAN DEFAULT 1,
            table_map_enabled BOOLEAN DEFAULT 1,
            takeaway_enabled BOOLEAN DEFAULT 1,
            waiter_service_enabled BOOLEAN DEFAULT 1,
            enforce_menu_view BOOLEAN DEFAULT 0,
            cashier_offer_enabled BOOLEAN DEFAULT 0,
            cashier_offer_label VARCHAR(255) DEFAULT "",
            cashier_offer_discount DECIMAL(10,2) DEFAULT 0,
            cashier_qr_upload_enabled BOOLEAN DEFAULT 1,
            standard_qr_url TEXT,
            standard_qr_file_id VARCHAR(255),
            secondary_qr_url TEXT,
            secondary_qr_file_id VARCHAR(255),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS daily_analytics (
            id VARCHAR(36) PRIMARY KEY,
            date DATE NOT NULL UNIQUE,
            total_orders INT DEFAULT 0,
            completed_orders INT DEFAULT 0,
            cancelled_orders INT DEFAULT 0,
            revenue DECIMAL(15,2) DEFAULT 0,
            avg_order_value DECIMAL(10,2) DEFAULT 0,
            dine_in_orders INT DEFAULT 0,
            takeaway_orders INT DEFAULT 0,
            dine_in_revenue DECIMAL(15,2) DEFAULT 0,
            takeaway_revenue DECIMAL(15,2) DEFAULT 0,
            total_tax DECIMAL(15,2) DEFAULT 0,
            total_discount DECIMAL(15,2) DEFAULT 0,
            items_sold INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS payments (
            id VARCHAR(36) PRIMARY KEY,
            order_id VARCHAR(36) NOT NULL,
            payment_method VARCHAR(50),
            transaction_id VARCHAR(255),
            amount DECIMAL(10,2) NOT NULL,
            amount_received DECIMAL(10,2),
            \`change\` DECIMAL(10,2),
            change_amount DECIMAL(10,2) DEFAULT 0,
            discount DECIMAL(10,2) DEFAULT 0,
            discount_label VARCHAR(255),
            cashier_id VARCHAR(36),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS payment_audits (
            id VARCHAR(36) PRIMARY KEY,
            order_id VARCHAR(36),
            payment_id VARCHAR(36),
            action VARCHAR(100) NOT NULL,
            status VARCHAR(50),
            amount DECIMAL(10,2),
            payment_method VARCHAR(50),
            performed_by VARCHAR(36),
            performed_by_role VARCHAR(50),
            ip_address VARCHAR(45),
            user_agent TEXT,
            error_message TEXT,
            error_code VARCHAR(100),
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    for (const query of queries) {
        await mysql.query(query);
    }
    console.log('Tables verified and schemas initialized.');
};

const importData = async () => {
    try {
        await createTables();

        // ── Users ────────────────────────────────────────────────────────────
        console.log('Creating staff...');
        const staff = [
            { id: crypto.randomUUID(), username: 'admin',   passwordHash: await hash('admin123'),   role: 'admin',   name: 'Admin' },
            { id: crypto.randomUUID(), username: 'waiter',  passwordHash: await hash('waiter123'),  role: 'waiter',  name: 'Waiter' },
            { id: crypto.randomUUID(), username: 'kitchen', passwordHash: await hash('kitchen123'), role: 'kitchen', name: 'Kitchen' },
            { id: crypto.randomUUID(), username: 'cashier', passwordHash: await hash('cashier123'), role: 'cashier', name: 'Cashier' },
        ];

        for (const u of staff) {
            await mysql.query(
                'INSERT INTO users (id, username, password_hash, role, name, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
                [u.id, u.username, u.passwordHash, u.role, u.name, 1]
            );
        }
        console.log('SUCCESS: Users created.');
        const waiterId = staff.find(s => s.role === 'waiter').id;

        // ── Settings ─────────────────────────────────────────────────────────
        console.log('Creating settings...');
        await mysql.query(
            'INSERT INTO settings (restaurant_name, address, currency, currency_symbol, tax_rate, sgst, cgst, gst_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ['KAGZSO RESTAURANT', '123 Main St, Food City', 'INR', '₹', 0, 2.5, 2.5, 'GST33KAGZSO007']
        );

        // ── Counters ─────────────────────────────────────────────────────────
        await mysql.query('INSERT INTO counters (counter_key, sequence_value) VALUES (?, ?)', ['tokenNumber_global', 120]);

        // ── Categories ───────────────────────────────────────────────────────
        console.log('Creating categories with images...');
        const categoriesData = [
            { name: 'Starters', description: 'Flavorful appetizers to start your meal.', image: '/images/starters.png', color: '#f97316' },
            { name: 'Main Course', description: 'Our signature hearty dishes.', image: '/images/main-course.png', color: '#10b981' },
            { name: 'Tandoor', description: 'Authentic charcoal grilled delights.', image: '/images/tandoor.png', color: '#dc2626' },
            { name: 'Breads', description: 'Freshly baked Indian breads.', image: '/images/breads.png', color: '#8b5cf6' },
            { name: 'Salads', description: 'Fresh and crunchy sides.', image: '/images/salads.png', color: '#22c55e' },
            { name: 'Beverages', description: 'Refreshing drinks and shakes.', image: '/images/beverages.png', color: '#3b82f6' },
            { name: 'Desserts', description: 'Sweet ending to your perfect meal.', image: '/images/desserts.png', color: '#ec4899' },
        ];

        const catMap = {};
        for (const c of categoriesData) {
            const cid = crypto.randomUUID();
            await mysql.query(
                'INSERT INTO categories (id, name, description, image, color, status, is_active) VALUES (?, ?, ?, ?, ?, "active", 1)',
                [cid, c.name, c.description, c.image, c.color]
            );
            catMap[c.name] = cid;
        }

        // ── Menu Items ───────────────────────────────────────────────────────
        console.log('Creating full menu with mapped images...');
        const items = [
            // STARTERS
            { name: 'Chicken 65', price: 280, cat: 'Starters', img: 'chicken-65.jpg', veg: 0 },
            { name: 'Chicken Lollipop', price: 320, cat: 'Starters', img: 'chicken-lolipop.jpg', veg: 0 },
            { name: 'Chicken Wings', price: 250, cat: 'Starters', img: 'chicken-wings.jpg', veg: 0 },
            { name: 'Chilly Chicken', price: 300, cat: 'Starters', img: 'chilly-chicken.jpg', veg: 0 },
            { name: 'Hara Bhara Kabab', price: 220, cat: 'Starters', img: 'hara-bhara-kabab.jpg', veg: 1 },
            
            // MAIN COURSE
            { name: 'Butter Chicken', price: 450, cat: 'Main Course', img: 'butter-chicken.jpg', veg: 0 },
            { name: 'Chicken Biryani', price: 380, cat: 'Main Course', img: 'chicken-biryani.jpg', veg: 0 },
            { name: 'Chicken Noodles', price: 240, cat: 'Main Course', img: 'chicken-noodles.jpg', veg: 0 },
            { name: 'Chicken Rice', price: 220, cat: 'Main Course', img: 'chicken-rice.jpg', veg: 0 },
            { name: 'Dal Makhani', price: 260, cat: 'Main Course', img: 'dal-makhani.jpg', veg: 1 },
            { name: 'Kadhai Paneer', price: 320, cat: 'Main Course', img: 'kadhai-paneer.jpg', veg: 1 },
            { name: 'Mutton Biryani', price: 550, cat: 'Main Course', img: 'mutton-biryani.jpg', veg: 0 },
            { name: 'Mutton Gravy', price: 580, cat: 'Main Course', img: 'mutton-gravy.jpg', veg: 0 },
            
            // TANDOOR
            { name: 'Afghani Chicken', price: 350, cat: 'Tandoor', img: 'afghani-chicken.jpg', veg: 0 },
            { name: 'Chicken Tikka', price: 320, cat: 'Tandoor', img: 'chicken-tikka.jpg', veg: 0 },
            { name: 'Paneer Tikka', price: 280, cat: 'Tandoor', img: 'paneer-tikka.jpg', veg: 1 },
            { name: 'Tandoori Chicken', price: 420, cat: 'Tandoor', img: 'tandoori-chicken.jpg', veg: 0 },
            
            // BREADS
            { name: 'Garlic Naan', price: 80, cat: 'Breads', img: 'garlic-naan.jpg', veg: 1 },
            { name: 'Tandoori Roti', price: 40, cat: 'Breads', img: 'tandoori-roti.jpg', veg: 1 },
            
            // SALADS
            { name: 'Green Salad', price: 120, cat: 'Salads', img: 'green-salad.jpg', veg: 1 },
            { name: 'Kachumber Salad', price: 110, cat: 'Salads', img: 'kachumber-salad.jpg', veg: 1 },
            
            // BEVERAGES
            { name: 'Coke', price: 60, cat: 'Beverages', img: 'coke.jpg', veg: 1 },
            { name: 'Pepsi', price: 60, cat: 'Beverages', img: 'pepsi.jpg', veg: 1 },
            { name: 'Mango Lassi', price: 120, cat: 'Beverages', img: 'mango-lassi.jpg', veg: 1 },
            
            // DESSERTS
            { name: 'Chocolate Brownie', price: 180, cat: 'Desserts', img: 'chocolate-brownie.jpg', veg: 1 },
            { name: 'Gulab Jamun', price: 100, cat: 'Desserts', img: 'gulab-jamun.jpg', veg: 1 },
        ];

        for (const item of items) {
            const mid = crypto.randomUUID();
            await mysql.query(
                'INSERT INTO menu_items (id, name, price, category_id, image, is_veg, availability, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
                [mid, item.name, parseFloat(item.price), catMap[item.cat], `/images/items/${item.img}`, item.veg, 1]
            );
        }
        console.log(`SUCCESS: ${items.length} menu items added.`);

        // ── Tables ───────────────────────────────────────────────────────────
        const tableConfigs = [
            // Standard numeric
            ...['1','2','3','4','5','6','7','8','9'].map(n => ({ n, c: 4 })),
            // Alphanumeric
            { n: '1A', c: 2 }, { n: '1B', c: 2 },
            { n: '2A', c: 2 }, { n: '2B', c: 2 },
            { n: '10', c: 6 }, { n: '11', c: 6 }, { n: '12', c: 8 }
        ];

        for (const t of tableConfigs) {
            await mysql.query(
                'INSERT INTO tables (id, number, capacity, status) VALUES (?, ?, ?, "available")',
                [crypto.randomUUID(), t.n, t.c]
            );
        }
        console.log(`SUCCESS: ${tableConfigs.length} tables created (Standard & Alphanumeric).`);

        console.log('\nFULL SEED COMPLETE! Enjoy your new menu.\n');
    } catch (error) {
        console.error('--- SEED ERROR ---');
        console.error(error);
    } finally {
        process.exit(0);
    }
};

importData();
