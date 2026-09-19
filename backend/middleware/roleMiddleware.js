import { ApiError } from '../utils/apiResponse.js';

/**
 * Restricts a route to specific roles. Must run AFTER `protect`
 * (relies on req.user being set).
 *
 * Usage: router.get('/admin/x', protect, authorize('ADMIN'), handler)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized, no user context'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Role '${req.user.role}' is not permitted to access this resource`)
      );
    }

    next();
  };
};

export default authorize;
