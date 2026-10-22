const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

router.get('/', requireAuth, notificationController.getNotifications);
router.post('/', requireAuth, notificationController.createAlert);
router.put('/read-all', requireAuth, notificationController.markAllAsRead);
router.put('/:id/read', requireAuth, notificationController.markAsRead);
router.delete('/:id', requireAuth, notificationController.deleteNotification);
router.delete('/', requireAuth, notificationController.clearAllNotifications);
router.post('/subscribe', requireAuth, notificationController.subscribeToPush);

module.exports = router;

