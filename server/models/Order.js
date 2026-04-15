const mysql = require('../config/mysql');
const crypto = require('crypto');
const Counter = require('./Counter');

const fmtItem = (row) => ({
    _id: row.id,
    menuItemId: row.menu_item_id,
    name: row.name,
    price: parseFloat(row.price),
    quantity: row.quantity,
    notes: row.notes,
    variant: row.variant ? (typeof row.variant === 'string' ? JSON.parse(row.variant) : row.variant) : null,
    status: row.status,
    cancelledBy: row.cancelled_by,
    cancelReason: row.cancel_reason,
    cancelledAt: row.cancelled_at,
    isNewlyAdded: row.is_newly_added === 1,
    addedAt: row.created_at,
    createdAt: row.created_at,
});

const fmtOrder = (row, items = [], tableNum = null) => ({
    _id: row.id,
    orderNumber: row.order_number,
    tokenNumber: row.token_number,
    orderType: row.order_type,
    tableId: row.table_id
        ? { _id: row.table_id, number: tableNum || '?' }
        : null,
    customerInfo: { name: row.customer_name || null, phone: row.customer_phone || null },
    items,
    orderStatus: row.order_status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    kotStatus: row.kot_status,
    totalAmount: parseFloat(row.total_amount),
    sgst: parseFloat(row.sgst || 0),
    cgst: parseFloat(row.cgst || 0),
    discount: parseFloat(row.discount || 0),
    discountLabel: row.discount_label || '',
    finalAmount: parseFloat(row.final_amount),
    waiterId: row.waiter_id,
    prepStartedAt: row.prep_started_at,
    isPartiallyReady: row.is_partially_ready === 1,
    readyAt: row.ready_at,
    completedAt: row.completed_at,
    paymentAt: row.payment_at,
    paidAt: row.paid_at,
    cancelledBy: row.cancelled_by,
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const loadItems = async (orderId) => {
    const [rows] = await mysql.query('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC', [orderId]);
    return rows.map(fmtItem);
};

const Order = {
    async findById(id) {
        try {
            const [orders] = await mysql.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
            const order = orders[0];
            if (!order) return null;

            let tableNum = null;
            if (order.table_id) {
                const [tables] = await mysql.query('SELECT number FROM tables WHERE id = ? LIMIT 1', [order.table_id]);
                if (tables[0]) tableNum = tables[0].number;
            }
            const items = await loadItems(id);
            return fmtOrder(order, items, tableNum);
        } catch (error) {
            return null;
        }
    },

    async find(filter = {}, { skip = 0, limit = 50 } = {}) {
        const { where, values } = buildWhereClause(filter);
        const query = `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        const [rows] = await mysql.query(query, [...values, parseInt(limit), parseInt(skip)]);
        
        if (rows.length === 0) return [];

        const [itemsResp] = await mysql.query('SELECT * FROM order_items WHERE order_id IN (?)', [rows.map(r => r.id)]);
        const [tables] = await mysql.query('SELECT id, number FROM tables');
        const tableMap = {};
        tables.forEach(t => tableMap[t.id] = t.number);

        const itemsByOrderId = {};
        itemsResp.forEach(item => {
            if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
            itemsByOrderId[item.order_id].push(fmtItem(item));
        });

        return rows.map(row => fmtOrder(row, itemsByOrderId[row.id] || [], tableMap[row.table_id]));
    },

    async count(filter = {}) {
        const { where, values } = buildWhereClause(filter);
        const [rows] = await mysql.query(`SELECT COUNT(*) as count FROM orders ${where}`, values);
        return rows[0].count;
    },

    async create(data) {
        const orderType = data.orderType || 'dine-in';
        const totalAmount = Number(data.totalAmount) || 0;
        const sgst = Number(data.sgst) || 0;
        const cgst = Number(data.cgst) || 0;
        const discount = Number(data.discount) || 0;
        let finalAmount = Number(data.finalAmount) || (totalAmount - discount + sgst + cgst);

        const seq = await Counter.getNextSequence('tokenNumber_global');
        const orderNumber = `ORD-${seq}`;
        const orderId = crypto.randomUUID();

        // 17 Columns — All validated against schema (DESCRIBE orders)
        const sql = `
            INSERT INTO orders (
                id, order_number, token_number, order_type, table_id, 
                customer_name, customer_phone, total_amount, sgst, cgst, 
                discount, final_amount, waiter_id, order_status, payment_status, 
                payment_method, kot_status
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?, 'Open')
        `;

        const values = [
            orderId, orderNumber, seq, orderType, data.tableId || null, 
            data.customerInfo?.name || null, data.customerInfo?.phone || null, 
            totalAmount, sgst, cgst, discount, finalAmount, data.waiterId || null, 
            data.paymentMethod || null
        ];

        await mysql.query(sql, values);

        const itemInserts = (data.items || []).map(item => {
            const itemId = crypto.randomUUID();
            return mysql.query(
                `INSERT INTO order_items (id, order_id, menu_item_id, name, price, quantity, notes, variant, status, is_newly_added) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0)`,
                [itemId, orderId, item.menuItemId || null, item.name || 'Item', parseFloat(item.price || 0), parseInt(item.quantity), item.notes || null, item.variant ? JSON.stringify(item.variant) : null]
            );
        });

        await Promise.all(itemInserts);
        return this.findById(orderId);
    },

    async updateById(id, updates) {
        const fieldMap = {
            orderNumber: 'order_number',
            orderStatus: 'order_status',
            paymentStatus: 'payment_status',
            paymentMethod: 'payment_method',
            kotStatus: 'kot_status',
            totalAmount: 'total_amount',
            sgst: 'sgst',
            cgst: 'cgst',
            discount: 'discount',
            discountLabel: 'discount_label',
            finalAmount: 'final_amount',
            prepStartedAt: 'prep_started_at',
            readyAt: 'ready_at',
            completedAt: 'completed_at',
            paymentAt: 'payment_at',
            paidAt: 'paid_at',
            cancelledBy: 'cancelled_by',
            cancelReason: 'cancel_reason',
            isPartiallyReady: 'is_partially_ready',
        };

        const updateKeys = [];
        const updateValues = [];

        for (const [key, val] of Object.entries(updates)) {
            // CRITICAL: Only allow updates if the key exists in our validated fieldMap
            if (fieldMap[key]) {
                updateKeys.push(`\`${fieldMap[key]}\` = ?`);
                updateValues.push(val === undefined ? null : val);
            }
        }

        if (updateKeys.length === 0) return this.findById(id);
        
        updateValues.push(id);
        const query = `UPDATE orders SET ${updateKeys.join(', ')} WHERE id = ?`;
        await mysql.query(query, updateValues);
        return this.findById(id);
    },

    async atomicPaymentStatusUpdate(id, fromStatus, toStatus) {
        const query = 'UPDATE orders SET payment_status = ? WHERE id = ? AND payment_status = ?';
        const [result] = await mysql.query(query, [toStatus, id, fromStatus]);
        if (result.affectedRows === 0) return null;
        return this.findById(id);
    },

    async updateItemStatus(orderId, itemId, status) {
        await mysql.query('UPDATE order_items SET status = ? WHERE id = ?', [status, itemId]);
        return this.findById(orderId);
    },

    async cancelItem(orderId, itemId, { cancelledBy, cancelReason }) {
        await mysql.query(
            'UPDATE order_items SET status = "CANCELLED", cancelled_by = ?, cancel_reason = ?, cancelled_at = ? WHERE id = ?',
            [cancelledBy, cancelReason, new Date().toISOString().slice(0, 19).replace('T', ' '), itemId]
        );
        return this.findById(orderId);
    },

    async addItems(orderId, items, { totalAmount, sgst, cgst, finalAmount }) {
        const [orders] = await mysql.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
        const orderInfo = orders[0];
        if (!orderInfo || ['completed', 'cancelled'].includes(orderInfo.order_status)) {
            throw new Error(`Cannot add items to ${orderInfo?.order_status || 'missing'} order`);
        }

        const itemInserts = items.map(item => {
            const itemId = crypto.randomUUID();
            return mysql.query(
                `INSERT INTO order_items (id, order_id, menu_item_id, name, price, quantity, notes, variant, status, is_newly_added) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1)`,
                [itemId, orderId, item.menuItemId || null, item.name || 'Item', parseFloat(item.price), parseInt(item.quantity), item.notes || null, item.variant ? JSON.stringify(item.variant) : null]
            );
        });

        await Promise.all(itemInserts);

        // Recalculate totals - use settings from database for tax rates
        const [allRows] = await mysql.query('SELECT * FROM order_items WHERE order_id = ? AND status != "CANCELLED"', [orderId]);
        const subtotalSum = allRows.reduce((sum, i) => sum + (parseFloat(i.price) * parseInt(i.quantity)), 0);
        const existingSubtotal = parseFloat(orderInfo.total_amount) || 0;
        const existingDiscount = parseFloat(orderInfo.discount) || 0;
        
        // Get tax rates from settings
        const [settingsRows] = await mysql.query('SELECT sgst, cgst FROM settings LIMIT 1');
        const settingsSgstRate = parseFloat(settingsRows[0]?.sgst || 0) / 100;
        const settingsCgstRate = parseFloat(settingsRows[0]?.cgst || 0) / 100;
        
        // Use existing order's rate if valid (>0), otherwise use settings rate from admin
        const existingSgst = parseFloat(orderInfo.sgst) || 0;
        const existingCgst = parseFloat(orderInfo.cgst) || 0;
        const existingSgstRate = existingSubtotal > 0 && existingSgst > 0 ? existingSgst / existingSubtotal : 0;
        const existingCgstRate = existingSubtotal > 0 && existingCgst > 0 ? existingCgst / existingSubtotal : 0;
        const sgstRate = settingsSgstRate;
        const cgstRate = settingsCgstRate;
        
        const discValue = parseFloat(orderInfo.discount) || 0;
        const discountedSubtotal = Math.max(0, subtotalSum - discValue);

        const newTotalSgst = parseFloat((discountedSubtotal * sgstRate).toFixed(2));
        const newTotalCgst = parseFloat((discountedSubtotal * cgstRate).toFixed(2));
        const newFinal = parseFloat((discountedSubtotal + newTotalSgst + newTotalCgst).toFixed(2));

        await mysql.query(
            'UPDATE orders SET total_amount = ?, sgst = ?, cgst = ?, final_amount = ?, kot_status = "Open", order_status = "pending" WHERE id = ?',
            [subtotalSum, newTotalSgst, newTotalCgst, newFinal, orderId]
        );

        return this.findById(orderId);
    },
    async getItemById(orderId, itemId) {
        const [rows] = await mysql.query(
            'SELECT * FROM order_items WHERE order_id = ? AND id = ? LIMIT 1',
            [orderId, itemId]
        );
        if (!rows[0]) return null;
        return fmtItem(rows[0]);
    },

    async search(q, limit = 30) {
        const pattern = `%${q}%`;
        const query = `
            SELECT o.* 
            FROM orders o
            LEFT JOIN tables t ON o.table_id = t.id
            WHERE o.order_number LIKE ? 
               OR o.customer_name LIKE ? 
               OR t.number LIKE ?
            ORDER BY o.created_at DESC
            LIMIT ?
        `;
        const [rows] = await mysql.query(query, [pattern, pattern, pattern, parseInt(limit)]);
        
        if (rows.length === 0) return [];

        const orderIds = rows.map(r => r.id);
        const [itemsResp] = await mysql.query('SELECT * FROM order_items WHERE order_id IN (?)', [orderIds]);
        const itemsByOrderId = {};
        itemsResp.forEach(item => {
            if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
            itemsByOrderId[item.order_id].push(fmtItem(item));
        });

        const [tables] = await mysql.query('SELECT id, number FROM tables');
        const tableMap = {};
        tables.forEach(t => tableMap[t.id] = t.number);

        return rows.map(row => fmtOrder(row, itemsByOrderId[row.id] || [], tableMap[row.table_id]));
    },
};

function buildWhereClause(filter) {
    const conditions = [];
    const values = [];

    if (filter.kotStatus) {
        if (typeof filter.kotStatus === 'object' && filter.kotStatus.$ne) {
            conditions.push('kot_status != ?');
            values.push(filter.kotStatus.$ne);
        } else {
            conditions.push('kot_status = ?');
            values.push(filter.kotStatus);
        }
    }

    if (filter.orderStatus) {
        if (typeof filter.orderStatus === 'object' && filter.orderStatus.$in) {
            conditions.push('order_status IN (?)');
            values.push(filter.orderStatus.$in);
        } else {
            conditions.push('order_status = ?');
            values.push(filter.orderStatus);
        }
    }

    if (filter.paymentStatus) {
        conditions.push('payment_status = ?');
        values.push(filter.paymentStatus);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { where, values };
}

module.exports = Order;
