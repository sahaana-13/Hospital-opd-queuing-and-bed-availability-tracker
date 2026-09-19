import jwt from 'jsonwebtoken';

/**
 * Signs a JWT containing the user's id and role.
 * Kept as a standalone utility so authController and any future
 * refresh/reset flows share one source of truth for token shape.
 */
const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

export default generateToken;
