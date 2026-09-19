import { validationResult } from 'express-validator';
import { ApiError } from './apiResponse.js';

/**
 * Runs after an array of express-validator checks in a route.
 * Collects all validation errors into a single 400 ApiError so the
 * error shape stays consistent with the rest of the API.
 */
export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    const error = new ApiError(400, 'Validation failed');
    error.details = messages;
    return next(error);
  }
  next();
};
