import express from 'express';
import { body } from 'express-validator';
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
} from '../controllers/departmentController.js';
import { handleValidation } from '../utils/validationHandler.js';
import protect from '../middleware/authMiddleware.js';
import authorize from '../middleware/roleMiddleware.js';

const router = express.Router();

const createValidators = [
  body('name').trim().notEmpty().withMessage('Department name is required'),
  body('description').optional().trim(),
];

const updateValidators = [
  body('name').optional().trim().notEmpty().withMessage('Department name cannot be empty'),
  body('description').optional().trim(),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

// All department routes require authentication; viewing is open to any role.
router.use(protect);

// @route   GET /api/departments
router.get('/', getDepartments);

// @route   GET /api/departments/:id
router.get('/:id', getDepartmentById);

// @route   POST /api/departments
router.post('/', authorize('ADMIN'), createValidators, handleValidation, createDepartment);

// @route   PATCH /api/departments/:id
router.patch('/:id', authorize('ADMIN'), updateValidators, handleValidation, updateDepartment);

// @route   DELETE /api/departments/:id (soft-delete → isActive:false)
router.delete('/:id', authorize('ADMIN'), deactivateDepartment);

export default router;
