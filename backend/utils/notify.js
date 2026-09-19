import Notification from '../models/Notification.js';
import { emitUserNotification } from '../sockets/socketHandler.js';

/**
 * Creates a Notification document AND pushes it in real time to the
 * user's socket room, in one call. This is the single entry point
 * controllers should use to notify a user — it guarantees the
 * notification is never lost (persisted to DB) even if the push
 * doesn't reach an offline client.
 *
 * @param {import('socket.io').Server|null} io - pass null to skip the live push (e.g. seed scripts)
 * @param {string} userId
 * @param {string} title
 * @param {string} message
 * @param {'QUEUE_UPDATE'|'YOUR_TURN'|'APPOINTMENT'|'BED_UPDATE'|'SYSTEM'} type
 */
const notifyUser = async (io, userId, title, message, type) => {
  try {
    const notification = await Notification.create({ user: userId, title, message, type });
    emitUserNotification(io, userId, notification);
    return notification;
  } catch (err) {
    // Notifications are a best-effort side channel — a failure here
    // must never break the primary action (booking, call-next, etc).
    console.error(`Failed to create notification for user ${userId}: ${err.message}`);
    return null;
  }
};

export default notifyUser;
