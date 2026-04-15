const mysql = require('../config/mysql');

// ── Label formatter ───────────────────────────────────────────────────────────
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatGroupLabel(raw, range) {
    if (raw === null || raw === undefined) return String(raw);
    if (range === 'year') {
        const m = parseInt(raw) - 1; // MySQL MONTH() is 1-12
        return FULL_MONTHS[m] ?? String(raw);
    }
    if (range === 'week' || range === 'month') {
        const d = new Date(raw);
        return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
    }
    return String(raw).padStart(2, '0') + ':00';
}

function rangeStart(range) {
    const now = new Date();
    switch (range) {
        case 'today':
            { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
        case 'week':
            { const d = new Date(now); d.setDate(now.getDate() - 7); d.setHours(0, 0, 0, 0); return d; }
        case 'month':
            { const d = new Date(now); d.setDate(now.getDate() - 30); d.setHours(0, 0, 0, 0); return d; }
        case 'year':
            { const d = new Date(now); d.setFullYear(now.getFullYear() - 1); d.setHours(0, 0, 0, 0); return d; }
        default:
            return null;
    }
}

/**
 * @desc    Comprehensive analytics summary (all time or by range)
 */
const getSummary = async (req, res) => {
    try {
        const { range } = req.query;
        const start = rangeStart(range);
        
        let where = 'WHERE payment_status = "paid"';
        let params = [];
        if (start) {
            where += ' AND created_at >= ?';
            params.push(start);
        }

        const [rows] = await mysql.query(
            `SELECT 
                SUM(final_amount) as totalRevenue, 
                SUM(sgst) as totalSgst, 
                SUM(cgst) as totalCgst, 
                COUNT(*) as orderCount 
             FROM orders ${where}`,
            params
        );

        const summary = rows[0];
        const totalRevenue = parseFloat(summary.totalRevenue || 0);
        const totalSgst = parseFloat(summary.totalSgst || 0);
        const totalCgst = parseFloat(summary.totalCgst || 0);
        const orderCount = parseInt(summary.orderCount || 0);

        // Payment Method breakdown
        const [payRows] = await mysql.query(
            `SELECT payment_method, SUM(final_amount) as amount FROM orders ${where} GROUP BY payment_method`,
            params
        );

        const paymentSummary = { cash: 0, qr: 0, online: 0 };
        payRows.forEach(r => {
            const method = (r.payment_method || 'cash').toLowerCase();
            paymentSummary[method] = parseFloat(r.amount || 0);
        });

        res.json({
            totalRevenue,
            totalSgst,
            totalCgst,
            orderCount,
            avgOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0,
            paymentSummary
        });
    } catch (error) {
        console.error('[analyticsController] getSummary error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Hourly/Daily revenue distribution
 */
const getHeatmap = async (req, res) => {
    try {
        const { type, range } = req.query;
        const start = rangeStart(range);
        
        let select = type === 'hourly' ? 'HOUR(created_at) as label' : 'DAYOFWEEK(created_at) as label';
        let where = 'WHERE payment_status = "paid"';
        let params = [];
        if (start) {
            where += ' AND created_at >= ?';
            params.push(start);
        }

        const [rows] = await mysql.query(
            `SELECT ${select}, SUM(final_amount) as revenue, COUNT(*) as count FROM orders ${where} GROUP BY label ORDER BY label ASC`,
            params
        );

        res.json(rows.map(r => ({
            [type === 'hourly' ? 'hour' : 'day']: r.label,
            revenue: parseFloat(r.revenue),
            count: r.count
        })));
    } catch (error) {
        console.error('[analyticsController] getHeatmap error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Waiter productivity ranking
 */
const getWaitersRanking = async (req, res) => {
    try {
        const { range } = req.query;
        const start = rangeStart(range);
        
        let where = 'WHERE o.payment_status = "paid"';
        let params = [];
        if (start) {
            where += ' AND o.created_at >= ?';
            params.push(start);
        }

        const query = `
            SELECT u.username as waiterName, COUNT(o.id) as totalOrders, SUM(o.final_amount) as totalRevenue,
            AVG(TIMESTAMPDIFF(SECOND, o.created_at, o.completed_at)) as avgCompletionTime
            FROM orders o
            JOIN users u ON o.waiter_id = u.id
            ${where}
            GROUP BY u.id
            ORDER BY totalRevenue DESC
        `;

        const [rows] = await mysql.query(query, params);

        res.json(rows.map(r => ({
            waiterName: r.waiterName,
            totalOrders: parseInt(r.totalOrders),
            totalRevenue: parseFloat(r.totalRevenue),
            avgCompletionTime: (parseFloat(r.avgCompletionTime || 0)) / 60
        })));
    } catch (error) {
        console.error('[analyticsController] getWaitersRanking error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Kitchen performance
 */
const getKitchenPerformance = async (req, res) => {
    try {
        const { range } = req.query;
        const start = rangeStart(range);
        
        let labelSelect;
        switch (range) {
            case 'week':
            case 'month': labelSelect = 'DATE(created_at)'; break;
            case 'year':  labelSelect = 'MONTH(created_at)'; break;
            default:      labelSelect = 'HOUR(created_at)'; break;
        }

        let where = 'WHERE payment_status = "paid" AND completed_at IS NOT NULL';
        let params = [];
        if (start) {
            where += ' AND created_at >= ?';
            params.push(start);
        }

        const query = `
            SELECT ${labelSelect} as label, 
            AVG(TIMESTAMPDIFF(SECOND, COALESCE(prep_started_at, created_at), COALESCE(ready_at, completed_at))) as avgPrepTime,
            COUNT(*) as ordersCompleted,
            SUM(CASE WHEN TIMESTAMPDIFF(SECOND, COALESCE(prep_started_at, created_at), COALESCE(ready_at, completed_at)) > 1200 THEN 1 ELSE 0 END) as delayedCount
            FROM orders
            ${where}
            GROUP BY label
            ORDER BY label ASC
        `;

        const [rows] = await mysql.query(query, params);

        res.json(rows.map(r => ({
            label: formatGroupLabel(r.label, range),
            avgPrepTime: (parseFloat(r.avgPrepTime || 0)) / 60,
            ordersCompleted: r.ordersCompleted,
            delayRate: (r.delayedCount / r.ordersCompleted) * 100
        })));
    } catch (error) {
        console.error('[analyticsController] getKitchenPerformance error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Time-based revenue report
 */
const getReport = async (req, res) => {
    try {
        const { range } = req.query;
        const start = rangeStart(range);
        if (!start) return res.status(400).json({ message: 'Invalid range' });

        if (range === 'today') {
            const [rows] = await mysql.query(
                `SELECT HOUR(created_at) as label, SUM(final_amount) as revenue, COUNT(*) as orders 
                 FROM orders WHERE payment_status = "paid" AND created_at >= ? 
                 GROUP BY label ORDER BY label ASC`,
                [start]
            );
            return res.json(rows.map(r => ({
                label: formatGroupLabel(r.label, range),
                revenue: parseFloat(r.revenue),
                orders: r.orders
            })));
        }

        const [rows] = await mysql.query(
            `SELECT date, revenue, completed_orders as orders FROM daily_analytics WHERE date >= ? ORDER BY date ASC`,
            [start]
        );

        res.json(rows.map(r => ({
            label: formatGroupLabel(r.date, range),
            revenue: parseFloat(r.revenue),
            orders: r.orders
        })));
    } catch (error) {
        console.error('[analyticsController] getReport error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Per-item performance
 */
const getItemPerformance = async (req, res) => {
    try {
        const { range } = req.query;
        const start = rangeStart(range);
        
        let where = 'WHERE o.payment_status = "paid" AND oi.status != "CANCELLED"';
        let params = [];
        if (start) {
            where += ' AND o.created_at >= ?';
            params.push(start);
        }

        const query = `
            SELECT oi.name as itemName, SUM(oi.quantity) as totalOrders, SUM(oi.price * oi.quantity) as totalRevenue,
            AVG(TIMESTAMPDIFF(SECOND, COALESCE(o.prep_started_at, o.created_at), COALESCE(o.ready_at, o.completed_at))) as avgPrepTime
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            ${where}
            GROUP BY oi.menu_item_id, oi.name
            ORDER BY totalRevenue DESC
            LIMIT 50
        `;

        const [rows] = await mysql.query(query, params);

        res.json(rows.map(r => ({
            itemName: r.itemName,
            totalOrders: parseInt(r.totalOrders),
            totalRevenue: parseFloat(r.totalRevenue),
            avgPrepTime: (parseFloat(r.avgPrepTime || 0)) / 60
        })));
    } catch (error) {
        console.error('[analyticsController] getItemPerformance error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getSummary, getHeatmap, getWaitersRanking, getKitchenPerformance, getReport, getItemPerformance };
