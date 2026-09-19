import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError } from '../utils/apiResponse.js';

/**
 * Verifies the Bearer JWT on the Authorization header, loads the
 * corresponding user, and attaches it to req.user.
 * Rejects with 401 for missing/invalid/expired tokens or a deleted/
 * deactivated account.
 */
const protect = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      throw new ApiError(401, 'Not authorized, no token provided');
    }

    // jwt.verify throws JsonWebTokenError/TokenExpiredError on failure —
    // both are handled centrally by errorMiddleware.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      throw new ApiError(401, 'Not authorized, user no longer exists');
    }

    if (!user.isActive) {
      throw new ApiError(401, 'This account has been deactivated');
    }

    req.user = user; // password excluded by default (select: false on schema)
    next();
  } catch (error) {
    next(error);
  }
};

export default protect;
