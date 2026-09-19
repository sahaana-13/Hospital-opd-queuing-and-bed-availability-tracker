import express from 'express';
import { body } from 'express-validator';
import {
  getAllUsers,
  getUserById,
  updateUserStatus,
  getAllAppointments,
  getAllQueues,
  getDashboard,
} from '../controllers/adminController.js';
import { handleValidation } from '../utils/validationHandler.js';
import protect from '../middleware/authMiddleware.js';
import authorize from '../middleware/roleMiddleware.js';

const router = express.Router();

// Every route in this file is admin-only.
router.use(protect, authorize('ADMIN'));

const updateStatusValidators = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

// @route   GET /api/admin/dashboard
router.get('/dashboard', getDashboard);

// @route   GET /api/admin/appointments  (optionally ?status=&department=&date=)
router.get('/appointments', getAllAppointments);

// @route   GET /api/admin/queues
router.get('/queues', getAllQueues);

// @route   GET /api/admin/users  (optionally ?role=)
router.get('/users', getAllUsers);

// @route   GET /api/admin/users/:id
router.get('/users/:id', getUserById);

// @route   PATCH /api/admin/users/:id/status
router.patch('/users/:id/status', updateStatusValidators, handleValidation, updateUserStatus);

export default router;
