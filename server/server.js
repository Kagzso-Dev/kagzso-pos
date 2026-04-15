require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const mysql = require('./config/mysql');
const logger = require('./utils/logger');
const { getCacheStats } = require('./utils/cache');
const { socketAuthMiddleware, authorizedRoomJoin, authorizedRoleJoin } = require('./middleware/socketAuth');
const { backfillDailyAnalytics } = require('./utils/dailyAnalytics');

const app = express();
const server = http.createServer(app);

// ─── Resolve client/dist path (works both locally and on VPS) ────────────────
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
const hasFrontend = fs.existsSync(CLIENT_DIST);

// ─── CORS Configuration ───────────────────────────────────────────────────────
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5005",
    "http://139.84.152.58:5005",
    "http://139.84.152.58:5173",

    process.env.CLIENT_URL
].filter(Boolean).map(o => o.trim().replace(/\/$/, ''));

const corsOriginFn = (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.trim().replace(/\/$/, '');
    const isAllowed = allowedOrigins.includes(normalizedOrigin) ||
        process.env.NODE_ENV === 'development';
    if (isAllowed) {
        callback(null, true);
    } else {
        logger.warn(`CORS blocked request from origin: ${origin}`);
        callback(null, false);
    }
};

const corsOptions = {
    origin: corsOriginFn,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*path', cors(corsOptions));

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
            fontSrc: ["'self'", 'data:'],
            workerSrc: ["'self'", 'blob:'],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(hpp());
app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(logger.requestLogger);
app.set('trust proxy', true);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
    skip: (req) => req.path === '/' || req.path === '/health',
});

if (process.env.NODE_ENV !== 'development') {
    app.use('/api', apiLimiter);
}

// ─── Socket.IO Server ─────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
    connectionStateRecovery: {
        maxDisconnectionDuration: 30 * 1000,
        skipMiddlewares: true,
    },
    maxHttpBufferSize: 1e6,
});

io.use(socketAuthMiddleware);
app.set('io', io);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/tables', require('./routes/tableRoutes'));
app.use('/api/menu', require('./routes/menuRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api', require('./routes/orderRoutes'));

const { protect, authorize } = require('./middleware/authMiddleware');
app.post('/api/analytics/backfill', protect, authorize('admin'), async (req, res) => {
    const forceAll = req.query.force === 'true';
    logger.info(`[backfill] Manual trigger by user ${req.userId} (forceAll=${forceAll})`);
    const result = await backfillDailyAnalytics(forceAll);
    res.json({ success: true, ...result });
});

// GET /api/analytics/daily
app.get('/api/analytics/daily', protect, authorize('admin'), async (req, res) => {
    try {
        const { range = 'month' } = req.query;
        let since;
        const now = new Date();
        switch (range) {
            case 'week': since = new Date(now); since.setDate(now.getDate() - 7); break;
            case 'year': since = new Date(now); since.setFullYear(now.getFullYear() - 1); break;
            case 'month':
            default: since = new Date(now); since.setDate(now.getDate() - 30); break;
        }
        const isoSince = since.toISOString().slice(0, 10);

        const [rows] = await mysql.query(
            'SELECT * FROM daily_analytics WHERE date >= ? ORDER BY date ASC',
            [isoSince]
        );

        res.json(rows.map(r => ({
            date: r.date.toISOString().slice(0, 10),
            totalOrders: r.total_orders,
            completedOrders: r.completed_orders,
            cancelledOrders: r.cancelled_orders,
            totalRevenue: parseFloat(r.revenue || 0),
            avgOrderValue: parseFloat(r.avg_order_value || 0),
            dineInOrders: r.dine_in_orders,
            takeawayOrders: r.takeaway_orders,
        })));
    } catch (err) {
        logger.error('[dailyAnalytics] GET error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── Socket.IO Events ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    logger.info('Socket connected', { id: socket.id, user: socket.userId });

    socket.on('join_branch', () => {
        authorizedRoomJoin(socket);
    });

    socket.on('join_role', (role) => {
        authorizedRoleJoin(socket, role);
    });

    socket.on('disconnect', (reason) => logger.info('Socket disconnected', { id: socket.id }));
});

// ─── Auto-Release Timer ──────────────────────────────────────────────────────
const { autoReleaseExpiredReservations } = require('./controllers/tableController');
setInterval(() => autoReleaseExpiredReservations(io), 2 * 60 * 1000);

// ─── Health Check ────────────────────────────────────────────────────────────
let _healthDbCache = { status: 'unknown', ts: 0 };
app.get('/health', async (req, res) => {
    const uptime = process.uptime();
    let dbStatus = _healthDbCache.status;
    if (Date.now() - _healthDbCache.ts > 30_000) {
        try {
            await mysql.query('SELECT 1');
            dbStatus = 'connected';
        } catch (e) {
            dbStatus = 'error';
        }
        _healthDbCache = { status: dbStatus, ts: Date.now() };
    }

    res.json({
        status: dbStatus === 'connected' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        database: { 
            state: dbStatus, 
            type: 'mysql',
            poolLimit: 10 
        },
        sockets: { 
            connected: io.engine.clientsCount,
            transport: 'live-websocket-polling'
        },
        cache: getCacheStats()
    });
});

// ─── Serve React Frontend ─────────────────────────────────────────────────────
if (hasFrontend) {
    app.use(express.static(CLIENT_DIST, { 
        maxAge: '1d',
        setHeaders: (res, path) => {
            if (path.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
        }
    }));
    app.get('*path', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
} else {
    app.get('/', (req, res) => res.json({ status: 'ok', message: 'API running. MySQL only.' }));
}

// ─── Serve Uploads (QR images, etc.) ──────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    logger.error('Unhandled route error', { error: err.message, stack: err.stack });
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const startServer = async () => {
    try {
        // Debug environment variables
        console.log('✅ Server Initialization:');
        console.log('  NODE_ENV:', process.env.NODE_ENV);
        console.log('  MYSQL_HOST:', process.env.MYSQL_HOST);
        console.log('  MYSQL_DATABASE:', process.env.MYSQL_DATABASE);

        logger.info('Initializing MySQL connectivity...');
        await backfillDailyAnalytics(false).catch(err => logger.warn('Backfill failed', { error: err.message }));
        const PORT = parseInt(process.env.PORT) || 5005;
        server.listen(PORT, '0.0.0.0', () => logger.info(`Server started on port ${PORT}`));
        autoReleaseExpiredReservations(io).catch(err => logger.warn('Initial release failed', { error: err.message }));
    } catch (err) {
        console.error('CRITICAL: Server startup failed', err);
        process.exit(1);
    }
};

startServer();
