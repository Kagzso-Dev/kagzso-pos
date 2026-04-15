const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, changePassword, getQrSettings, uploadQr } = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/authMiddleware');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { cacheMiddleware } = require('../utils/cache');

// ── Public Routes ──────────────────────────────────────────────
router.get('/', cacheMiddleware(60, 'settings'), getSettings);

// ── Protected Routes (Admin Only for most) ──────────────────────
router.use(protect);

router.put('/', authorize('admin'), updateSettings);
router.post('/change-password', authorize('admin'), changePassword);
router.get('/qr', getQrSettings);
router.post('/qr', authorize('admin', 'cashier'), upload.single('qr'), uploadQr);

module.exports = router;
