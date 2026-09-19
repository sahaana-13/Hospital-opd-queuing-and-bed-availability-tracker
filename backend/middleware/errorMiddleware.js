/**
 * Centralized error handler. Normalizes Mongoose/JWT/custom errors into
 * the consistent { success, message, error } response shape.
 * Must be registered LAST, after all routes.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode && err.statusCode !== 200 ? err.statusCode : 500;
  let message = err.message || 'Internal Server Error';
  let errorDetail = err.details || undefined; // populated by express-validator handler

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field '${err.path}'`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errorDetail = Object.values(err.errors).map((val) => val.message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `${field} already exists` : 'Duplicate field value';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
  }

  // Never leak stack traces or internal details in production
  const response = { success: false, message };
  if (errorDetail) response.error = errorDetail;
  if (process.env.NODE_ENV !== 'production' && err.stack && !errorDetail) {
    response.error = err.message;
  }

  if (statusCode === 500) {
    console.error('[ERROR]', err);
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
