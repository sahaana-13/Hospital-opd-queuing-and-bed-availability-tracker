/**
 * Standardized success response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {object|array|null} data
 */
export const sendSuccess = (res, statusCode = 200, message = 'Success', data = null) => {
  const payload = { success: true, message };
  if (data !== null && data !== undefined) payload.data = data;
  return res.status(statusCode).json(payload);
};

/**
 * Standardized error response.
 * Not typically called directly in controllers — prefer throwing an ApiError
 * and letting errorMiddleware handle formatting. Provided for edge cases.
 */
export const sendError = (res, statusCode = 500, message = 'Something went wrong', error = null) => {
  const payload = { success: false, message };
  if (error !== null && error !== undefined) payload.error = error;
  return res.status(statusCode).json(payload);
};

/**
 * Custom error class carrying an HTTP status code.
 * Thrown in controllers/services, caught by errorMiddleware.
 */
export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}
