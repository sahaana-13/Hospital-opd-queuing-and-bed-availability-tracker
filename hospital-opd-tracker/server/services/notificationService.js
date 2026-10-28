import Notification from '../models/Notification.js';
export async function notifyUser({ recipient, type, message, relatedResource }) {
  const notification = await Notification.create({ recipient, type, message, relatedResource });
  const io = globalThis.opdIO; if (io) io.to(`user:${recipient}`).emit('notification:new', { id: notification._id, type, message, createdAt: notification.createdAt, readAt: null });
  return notification;
}
