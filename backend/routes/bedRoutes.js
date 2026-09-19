import express from 'express';
import { body } from 'express-validator';
import {
  getWards,
  createWard,
  getBeds,
  getBedAvailability,
  getBedById,
  createBed,
  updateBedStatus,
} from '../controllers/bedController.js';
import { handleValidation } from '../utils/validationHandler.js';
import protect from '../middleware/authMiddleware.js';
import authorize from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

const createWardValidators = [
  body('name').trim().notEmpty().withMessage('Ward name is required'),
  body('type')
    .isIn(['GENERAL', 'ICU', 'EMERGENCY', 'PRIVATE', 'SEMI_PRIVATE'])
    .withMessage('Invalid ward type'),
  body('totalBeds').optional().isInt({ min: 0 }).withMessage('totalBeds must be a positive number'),
];

const createBedValidators = [
  body('bedNumber').trim().notEmpty().withMessage('Bed number is required'),
  body('ward').notEmpty().withMessage('Ward is required'),
];

const updateStatusValidators = [
  body('status')
    .isIn(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'])
    .withMessage('Invalid bed status'),
  body('patient').optional().isMongoId().withMessage('Invalid patient ID'),
];

// ---- Wards ----
// Mounted under /api/beds, so these resolve to /api/beds/wards.
// (Placed before '/:id' so 'wards' is never captured as a bed ID.)

// @route   GET /api/beds/wards
router.get('/wards', getWards);

// @route   POST /api/beds/wards
router.post('/wards', authorize('ADMIN'), createWardValidators, handleValidation, createWard);

// ---- Beds ----

// @route   GET /api/beds/availability
// Placed before '/:id' so 'availability' isn't captured as a bed ID.
router.get('/availability', getBedAvailability);

// @route   GET /api/beds  (optionally ?ward=&status=)
router.get('/', getBeds);

// @route   POST /api/beds
router.post('/', authorize('ADMIN'), createBedValidators, handleValidation, createBed);

// @route   GET /api/beds/:id
router.get('/:id', getBedById);

// @route   PATCH /api/beds/:id/status
router.patch(
  '/:id/status',
  authorize('ADMIN'),
  updateStatusValidators,
  handleValidation,
  updateBedStatus
);

export default router;
