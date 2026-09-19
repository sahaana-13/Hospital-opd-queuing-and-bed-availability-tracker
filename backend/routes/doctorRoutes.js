import express from 'express';
import { body } from 'express-validator';
import {
  getDoctors,
  getDoctorById,
  getMyDoctorProfile,
  createDoctor,
  updateDoctor,
} from '../controllers/doctorController.js';
import {
  getDoctorQueue,
  callNextPatient,
  completeToken,
  skipToken,
  getDoctorTodayStats,
} from '../controllers/queueController.js';
import { handleValidation } from '../utils/validationHandler.js';
import protect from '../middleware/authMiddleware.js';
import authorize from '../middleware/roleMiddleware.js';

const router = express.Router();

const createDoctorValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').matches(/^[0-9]{10}$/).withMessage('Phone number must be exactly 10 digits'),
  body('department').notEmpty().withMessage('Department is required'),
  body('specialization').trim().notEmpty().withMessage('Specialization is required'),
  body('licenseNumber').trim().notEmpty().withMessage('License number is required'),
  body('experience').optional().isInt({ min: 0 }).withMessage('Experience must be a positive number'),
  body('averageConsultationTime')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Average consultation time must be at least 1 minute'),
];

const updateDoctorValidators = [
  body('experience').optional().isInt({ min: 0 }),
  body('averageConsultationTime').optional().isInt({ min: 1 }),
  body('isAvailable').optional().isBoolean(),
];

// All routes require authentication.
router.use(protect);

// @route   GET /api/doctors  (optionally ?department=&available=true)
router.get('/', getDoctors);

// @route   GET /api/doctors/profile/me  (also reachable as /api/doctor/profile/me)
// Placed BEFORE '/:id' so it isn't shadowed by the param route.
router.get('/profile/me', authorize('DOCTOR'), getMyDoctorProfile);

// ---------------------------------------------------------------------
// Doctor queue operations (spec section 9) — reachable via the
// '/api/doctor' mount (see server.js). These are intentionally listed
// before '/:id' so literal segments like 'queue' or 'stats' are never
// swallowed by the ':id' param route below.
// ---------------------------------------------------------------------

// @route   GET /api/doctor/queue
router.get('/queue', authorize('DOCTOR'), getDoctorQueue);

// @route   GET /api/doctor/stats
router.get('/stats', authorize('DOCTOR'), getDoctorTodayStats);

// @route   POST /api/doctor/call-next
router.post('/call-next', authorize('DOCTOR'), callNextPatient);

// @route   POST /api/doctor/:tokenId/complete
router.post('/:tokenId/complete', authorize('DOCTOR'), completeToken);

// @route   POST /api/doctor/:tokenId/skip
router.post('/:tokenId/skip', authorize('DOCTOR'), skipToken);

// @route   GET /api/doctors/:id
router.get('/:id', getDoctorById);

// @route   POST /api/doctors
router.post('/', authorize('ADMIN'), createDoctorValidators, handleValidation, createDoctor);

// @route   PATCH /api/doctors/:id
router.patch(
  '/:id',
  authorize('ADMIN'),
  updateDoctorValidators,
  handleValidation,
  updateDoctor
);

export default router;
