import jwt from 'jsonwebtoken';

/**
 * Socket authentication middleware. Clients connect with:
 *   io("http://localhost:5000", { auth: { token: "<JWT>" } })
 *
 * If a valid token is supplied, the socket is auto-joined to a private
 * `user:<userId>` room — this is what lets us push personal
 * notifications (YOUR_TURN, etc.) without trusting a client-supplied
 * user ID. Connection is still allowed without a token (department/ward
 * subscriptions are public queue-board style data), so this middleware
 * never rejects a connection — it only optionally identifies it.
 */
const socketAuth = (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
    }
  } catch (err) {
    // Invalid/expired token: proceed as an unauthenticated socket rather
    // than hard-failing the connection — department/ward room features
    // still work without identity.
  }
  next();
};

/**
 * Initializes Socket.IO event listeners.
 * Clients join scoped rooms (department:<id>, ward:<id>) so we only
 * broadcast updates to interested subscribers, never globally.
 * Authenticated clients are also auto-joined to a private user:<id>
 * room for personal notifications.
 */
export const initSocket = (io) => {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}${socket.userId ? ` (user ${socket.userId})` : ''}`);

    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    socket.on('subscribe:department', (departmentId) => {
      if (!departmentId) return;
      socket.join(`department:${departmentId}`);
    });

    socket.on('subscribe:ward', (wardId) => {
      if (!wardId) return;
      socket.join(`ward:${wardId}`);
    });

    socket.on('unsubscribe:department', (departmentId) => {
      if (!departmentId) return;
      socket.leave(`department:${departmentId}`);
    });

    socket.on('unsubscribe:ward', (wardId) => {
      if (!wardId) return;
      socket.leave(`ward:${wardId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

/**
 * Emits a `queue:updated` event to everyone subscribed to a department's
 * room. Called by queueController after any state change that affects
 * the department's queue (booking, call-next, complete, skip, cancel).
 *
 * Payload is intentionally minimal — a "something changed, go refetch"
 * signal — so we never broadcast patient-identifying data to an entire
 * department's room of subscribers.
 *
 * @param {import('socket.io').Server} io
 * @param {string} departmentId
 * @param {object} [extra] - small non-sensitive extra fields (e.g. tokenNumber, status)
 */
export const emitQueueUpdate = (io, departmentId, extra = {}) => {
  if (!io || !departmentId) return;
  io.to(`department:${departmentId}`).emit('queue:updated', {
    departmentId: departmentId.toString(),
    ...extra,
  });
};

/**
 * Emits a `bed:updated` event to everyone subscribed to a ward's room.
 * Called by bedController after a bed's status changes.
 *
 * @param {import('socket.io').Server} io
 * @param {string} wardId
 * @param {object} [extra] - small non-sensitive extra fields (e.g. bedId, status)
 */
export const emitBedUpdate = (io, wardId, extra = {}) => {
  if (!io || !wardId) return;
  io.to(`ward:${wardId}`).emit('bed:updated', {
    wardId: wardId.toString(),
    ...extra,
  });
};

/**
 * Pushes a personal notification event to a specific user's private
 * socket room. Paired with a Notification document already persisted
 * to the DB (see utils/notify.js) — this is just the real-time push;
 * the DB record is what makes it show up in GET /api/notifications
 * even if the user wasn't online when it was created.
 *
 * @param {import('socket.io').Server} io
 * @param {string} userId
 * @param {object} notification - plain object, typically the created Notification doc
 */
export const emitUserNotification = (io, userId, notification) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit('notification:new', notification);
};

