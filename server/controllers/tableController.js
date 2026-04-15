const Table = require('../models/Table');

// ─── VALID STATUS TRANSITIONS ────────────────────────────────────────────────
const VALID_TRANSITIONS = {
    available: ['reserved', 'occupied'],
    reserved: ['occupied', 'available'],
    occupied: ['cleaning'],
    cleaning: ['available'],
};

// @desc    Get all tables
// @route   GET /api/tables
// @access  Private
const getTables = async (req, res) => {
    try {
        const Setting = require('../models/Setting');
        const settings = await Setting.get();
        
        // If tableMapEnabled is disabled, return empty array
        if (settings.tableMapEnabled === 0 || settings.tableMapEnabled === false) {
            return res.json([]);
        }
        
        const tables = await Table.findAll();
        res.json(tables);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a table
// @route   POST /api/tables
// @access  Private (Admin)
const createTable = async (req, res) => {
    const { number, capacity } = req.body;
    try {
        if (!number || String(number).trim() === '') {
            return res.status(400).json({ message: 'Table designation / number is required' });
        }
        
        const parsedCapacity = parseInt(capacity);
        if (!parsedCapacity || isNaN(parsedCapacity) || parsedCapacity < 1) {
            return res.status(400).json({ message: 'Capacity must be a positive integer' });
        }

        // Check for duplicate designation
        if (await Table.numberExists(String(number).trim())) {
            return res.status(400).json({ message: `Table "${number}" already exists` });
        }

        const table = await Table.create({ number: String(number).trim(), capacity: parsedCapacity });
        Table.clearMapCache();
        req.app.get('io').to('restaurant_main').emit('table-updated', { action: 'create', table });
        res.status(201).json(table);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update table status
// @route   PUT /api/tables/:id
const updateTable = async (req, res) => {
    const { status } = req.body;
    try {
        const table = await Table.findById(req.params.id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }

        if (status && status !== table.status) {
            const allowed = VALID_TRANSITIONS[table.status];
            if (!allowed || !allowed.includes(status)) {
                return res.status(400).json({
                    message: `Cannot change table from "${table.status}" to "${status}"`,
                });
            }
        }

        const updates = {};
        if (status) {
            updates.status = status;
            if (status === 'available') {
                updates.lockedBy = null;
                updates.reservedAt = null;
                updates.reservationExpiresAt = null;
                updates.currentOrderId = null;
            }
        }

        const updated = await Table.updateById(req.params.id, updates);
                Table.clearMapCache();
        req.app.get('io').to('restaurant_main').emit('table-updated', {
            tableId: updated._id,
            status: updated.status,
            lockedBy: updated.lockedBy,
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reserve a table
const reserveTable = async (req, res) => {
    try {
        const table = await Table.atomicReserve(req.params.id, req.user._id);
        if (!table) {
            const existing = await Table.findById(req.params.id);
            if (!existing) {
                return res.status(404).json({ message: 'Table not found' });
            }
            return res.status(400).json({
                message: `Table is currently "${existing.status}" and cannot be reserved`,
            });
        }
                Table.clearMapCache();
        req.app.get('io').to('restaurant_main').emit('table-updated', {
            tableId: table._id,
            status: 'reserved',
            lockedBy: table.lockedBy,
        });
        res.json(table);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Release a reserved table
const releaseTable = async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }
        if (table.status !== 'reserved') {
            return res.status(400).json({
                message: `Table is "${table.status}", only reserved tables can be released`,
            });
        }
        const updated = await Table.updateById(req.params.id, {
            status: 'available',
            lockedBy: null,
            reservedAt: null,
            reservationExpiresAt: null,
            currentOrderId: null,
        });
                Table.clearMapCache();
        req.app.get('io').to('restaurant_main').emit('table-updated', {
            tableId: updated._id, status: 'available',
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark table as cleaned
const markTableClean = async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }
        if (table.status !== 'cleaning') {
            return res.status(400).json({
                message: `Table is "${table.status}", only tables in "cleaning" can be marked clean`,
            });
        }
        const updated = await Table.updateById(req.params.id, {
            status: 'available',
            lockedBy: null,
            reservedAt: null,
            reservationExpiresAt: null,
            currentOrderId: null,
        });
                Table.clearMapCache();
        req.app.get('io').to('restaurant_main').emit('table-updated', {
            tableId: updated._id, status: 'available',
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Force reset table to available
const forceResetTable = async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }
        const updated = await Table.updateById(req.params.id, {
            status: 'available',
            lockedBy: null,
            reservedAt: null,
            reservationExpiresAt: null,
            currentOrderId: null,
        });
                Table.clearMapCache();
        req.app.get('io').to('restaurant_main').emit('table-updated', {
            tableId: updated._id, status: 'available',
        });
        res.json({ message: 'Table force-reset to available', table: updated });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete table
const deleteTable = async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        if (!table) {
            return res.status(404).json({ message: 'Table not found' });
        }
        if (table.status !== 'available') {
            return res.status(400).json({
                message: `Cannot delete table while status is "${table.status}". Reset it first.`,
            });
        }
        await Table.deleteById(req.params.id);
                Table.clearMapCache();
        req.app.get('io').to('restaurant_main').emit('table-updated', { action: 'delete', id: req.params.id });
        res.json({ message: 'Table removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── AUTO-RELEASE expired reservations ─────────────────────
const autoReleaseExpiredReservations = async (io) => {
    const TEN_MINUTES = 10 * 60 * 1000;
    const cutoff = new Date(Date.now() - TEN_MINUTES);
    try {
        const expiredTables = await Table.findExpiredReservations(cutoff);
        for (const table of expiredTables) {
            await Table.updateById(table._id, {
                status: 'available',
                lockedBy: null,
                reservedAt: null,
                reservationExpiresAt: null,
            });
            if (io) {
                io.to('restaurant_main').emit('table-updated', {
                    tableId: table._id, status: 'available',
                });
            }
        }
        if (expiredTables.length > 0) {
            console.log(`[AutoRelease] Released ${expiredTables.length} expired reservation(s)`);
        }
    } catch (error) {
        console.error('[AutoRelease] Error:', error.message);
    }
};

module.exports = {
    getTables,
    createTable,
    updateTable,
    reserveTable,
    releaseTable,
    markTableClean,
    forceResetTable,
    deleteTable,
    autoReleaseExpiredReservations,
};
