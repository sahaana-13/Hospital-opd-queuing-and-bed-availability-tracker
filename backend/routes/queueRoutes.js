import express from 'express';
import { body } from 'express-validator';
import {
  bookToken,
  getMyToken,
  getMyAppointmentHistory,
  getDepartmentQueue,
  getTokenStatus,
  cancelToken,
} from '../controllers/queueController.js';
import { handleValidation } from '../utils/validationHandler.js';
import protect from '../middleware/authMiddleware.js';
import authorize from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

// @route   POST /api/queue/book
router.post(
  '/book',
  authorize('PATIENT'),
  [body('doctorId').notEmpty().withMessage('doctorId is required')],
  handleValidation,
  bookToken
);

// @route   GET /api/queue/my-token
router.get('/my-token', authorize('PATIENT'), getMyToken);

// @route   GET /api/queue/history
router.get('/history', authorize('PATIENT'), getMyAppointmentHistory);

// @route   POST /api/queue/cancel/:tokenId
router.post('/cancel/:tokenId', authorize('PATIENT'), cancelToken);

// @route   GET /api/queue/:tokenId/status
// NOTE: intentionally placed after the more specific '/my-token' and
// '/cancel/:tokenId' routes so it doesn't shadow them.
router.get('/:tokenId/status', getTokenStatus);

// @route   GET /api/queue/:departmentId
// Any authenticated role can view a department's live queue board.
router.get('/:departmentId', getDepartmentQueue);

export default router;
