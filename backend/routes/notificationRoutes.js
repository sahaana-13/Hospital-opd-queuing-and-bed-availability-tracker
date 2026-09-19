import express from 'express';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// @route   GET /api/notifications  (optionally ?unreadOnly=true)
router.get('/', getMyNotifications);

// @route   PATCH /api/notifications/read-all
// Placed before '/:id/read' so 'read-all' is never captured as an ID.
router.patch('/read-all', markAllAsRead);

// @route   PATCH /api/notifications/:id/read
router.patch('/:id/read', markAsRead);

export default router;
