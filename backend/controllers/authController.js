import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { sendSuccess, ApiError } from '../utils/apiResponse.js';

/**
 * @route   POST /api/auth/register
 * @desc    Register a new PATIENT account. Doctors/Admins are created
 *          by an admin via /api/admin routes (Stage 7), not self-registration.
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, age, gender } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ApiError(409, 'An account with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      age,
      gender,
      role: 'PATIENT', // self-registration is always PATIENT
    });

    const token = generateToken(user._id, user.role);

    return sendSuccess(res, 201, 'Registration successful', {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Login for any role (patient/doctor/admin) via email + password.
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, 'Email and password are required');
    }

    // password has select:false on the schema — explicitly request it here.
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ApiError(401, 'This account has been deactivated');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const token = generateToken(user._id, user.role);

    return sendSuccess(res, 200, 'Login successful', {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Return the currently authenticated user's profile.
 * @access  Private (any authenticated role)
 */
export const getMe = async (req, res, next) => {
  try {
    // req.user was attached by the `protect` middleware and already
    // excludes the password hash.
    return sendSuccess(res, 200, 'Current user fetched successfully', {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        age: req.user.age,
        gender: req.user.gender,
        role: req.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
