import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { sendSuccess, ApiError } from '../utils/apiResponse.js';

/**
 * @route   GET /api/notifications
 * @desc    The logged-in user's notifications, newest first.
 *          Optional ?unreadOnly=true
 * @access  Private (any authenticated role)
 */
export const getMyNotifications = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.unreadOnly === 'true') {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter).sort({ createdAt: -1 });
    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });

    return sendSuccess(res, 200, 'Notifications fetched successfully', {
      notifications,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/notifications/:id/read
 * @access  Private (owner only)
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid notification ID');
    }

    const notification = await Notification.findOne({ _id: id, user: req.user._id });
    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    notification.isRead = true;
    await notification.save();

    return sendSuccess(res, 200, 'Notification marked as read', { notification });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    return sendSuccess(res, 200, 'All notifications marked as read', null);
  } catch (error) {
    next(error);
  }
};
