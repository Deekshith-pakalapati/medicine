const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.get('/profile', requireAuth, userController.getProfile);
router.post('/sync', requireAuth, userController.syncUser);
router.post('/role', requireAuth, userController.selectRole);
router.post('/link', requireAuth, userController.linkParent);
router.post('/unlink', requireAuth, userController.unlinkParent);
router.post('/refresh-code', requireAuth, userController.refreshInviteCode);

module.exports = router;
