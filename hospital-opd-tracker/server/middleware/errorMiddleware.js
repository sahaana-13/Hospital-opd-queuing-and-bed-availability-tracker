export function notFound(req, res, next) { next(Object.assign(new Error(`Route not found: ${req.method} ${req.originalUrl}`), { status: 404 })); }
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || (err.name === 'ValidationError' ? 400 : err.name === 'CastError' ? 400 : err.code === 11000 ? 409 : 500);
  let message = err.message || 'Unexpected server error';
  if (err.code === 11000) message = 'A record with this unique value already exists.';
  if (status >= 500) { console.error(`[${req.method} ${req.originalUrl}] ${message}`); message = 'An unexpected server error occurred.'; }
  res.status(status).json({ success: false, message, ...(err.details ? { details: err.details } : {}) });
}
