import mongoose from 'mongoose';
import Ward from '../models/Ward.js';
import Bed from '../models/Bed.js';
import { emitBedUpdate } from '../sockets/socketHandler.js';
import { sendSuccess, ApiError } from '../utils/apiResponse.js';

// Valid bed-status transitions. Used to reject nonsensical jumps like
// AVAILABLE -> COMPLETED-style invalid states (rule: "validate status
// transitions where appropriate").
const ALLOWED_TRANSITIONS = {
  AVAILABLE: ['RESERVED', 'OCCUPIED', 'MAINTENANCE'],
  RESERVED: ['OCCUPIED', 'AVAILABLE', 'MAINTENANCE'],
  OCCUPIED: ['CLEANING', 'MAINTENANCE'],
  CLEANING: ['AVAILABLE', 'MAINTENANCE'],
  MAINTENANCE: ['AVAILABLE'],
};

// ---------------------------------------------------------------------
// Wards
// ---------------------------------------------------------------------

/**
 * @route   GET /api/beds/wards
 * @access  Private (any authenticated role)
 */
export const getWards = async (req, res, next) => {
  try {
    const wards = await Ward.find({ isActive: true }).sort({ name: 1 });
    return sendSuccess(res, 200, 'Wards fetched successfully', { wards });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/beds/wards
 * @access  Private/Admin
 */
export const createWard = async (req, res, next) => {
  try {
    const { name, type, totalBeds } = req.body;

    const existing = await Ward.findOne({ name: name.trim() });
    if (existing) {
      throw new ApiError(409, 'A ward with this name already exists');
    }

    const ward = await Ward.create({ name, type, totalBeds: totalBeds || 0 });

    return sendSuccess(res, 201, 'Ward created successfully', { ward });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------
// Beds
// ---------------------------------------------------------------------

/**
 * @route   GET /api/beds
 * @desc    List beds, filterable by ?ward=<id>&status=<STATUS>
 * @access  Private (any authenticated role)
 */
export const getBeds = async (req, res, next) => {
  try {
    const { ward, status } = req.query;
    const filter = {};

    if (ward) {
      if (!mongoose.Types.ObjectId.isValid(ward)) {
        throw new ApiError(400, 'Invalid ward ID');
      }
      filter.ward = ward;
    }

    if (status) {
      const validStatuses = ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'];
      if (!validStatuses.includes(status)) {
        throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      filter.status = status;
    }

    const beds = await Bed.find(filter)
      .populate('ward', 'name type')
      .populate('patient', 'name phone')
      .sort({ bedNumber: 1 });

    return sendSuccess(res, 200, 'Beds fetched successfully', { beds });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/beds/availability
 * @desc    Per-ward bed availability summary.
 * @access  Private (any authenticated role)
 */
export const getBedAvailability = async (req, res, next) => {
  try {
    const wards = await Ward.find({ isActive: true });

    const summary = {};

    for (const ward of wards) {
      const counts = await Bed.aggregate([
        { $match: { ward: ward._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);

      const byStatus = counts.reduce((acc, c) => {
        acc[c._id] = c.count;
        return acc;
      }, {});

      const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

      summary[ward.name] = {
        total,
        available: byStatus.AVAILABLE || 0,
        occupied: byStatus.OCCUPIED || 0,
        reserved: byStatus.RESERVED || 0,
        cleaning: byStatus.CLEANING || 0,
        maintenance: byStatus.MAINTENANCE || 0,
      };
    }

    return sendSuccess(res, 200, 'Bed availability fetched successfully', summary);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/beds/:id
 * @access  Private (any authenticated role)
 */
export const getBedById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid bed ID');
    }

    const bed = await Bed.findById(id)
      .populate('ward', 'name type')
      .populate('patient', 'name phone');

    if (!bed) {
      throw new ApiError(404, 'Bed not found');
    }

    return sendSuccess(res, 200, 'Bed fetched successfully', { bed });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/beds
 * @desc    Admin creates a bed under a ward. Keeps Ward.totalBeds in
 *          sync so the availability summary and the ward record agree.
 * @access  Private/Admin
 */
export const createBed = async (req, res, next) => {
  try {
    const { bedNumber, ward } = req.body;

    if (!mongoose.Types.ObjectId.isValid(ward)) {
      throw new ApiError(400, 'Invalid ward ID');
    }

    const wardDoc = await Ward.findById(ward);
    if (!wardDoc) {
      throw new ApiError(404, 'Ward not found');
    }

    const existing = await Bed.findOne({ ward, bedNumber: bedNumber.trim() });
    if (existing) {
      throw new ApiError(409, 'A bed with this number already exists in this ward');
    }

    const bed = await Bed.create({ bedNumber, ward, status: 'AVAILABLE' });

    wardDoc.totalBeds += 1;
    await wardDoc.save();

    return sendSuccess(res, 201, 'Bed created successfully', { bed });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/beds/:id/status
 * @desc    Admin changes a bed's status. Validates the transition is
 *          logically allowed and manages patient/admittedAt/releasedAt
 *          bookkeeping automatically based on the transition.
 *          Body: { status, patient? }  (patient required when moving to OCCUPIED)
 * @access  Private/Admin
 */
export const updateBedStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, patient } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid bed ID');
    }

    const validStatuses = ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const bed = await Bed.findById(id);
    if (!bed) {
      throw new ApiError(404, 'Bed not found');
    }

    if (bed.status === status) {
      throw new ApiError(400, `Bed is already in status ${status}`);
    }

    const allowedNext = ALLOWED_TRANSITIONS[bed.status] || [];
    if (!allowedNext.includes(status)) {
      throw new ApiError(
        400,
        `Cannot transition bed from ${bed.status} to ${status}. Allowed: ${allowedNext.join(', ') || 'none'}`
      );
    }

    if (status === 'OCCUPIED') {
      if (!patient || !mongoose.Types.ObjectId.isValid(patient)) {
        throw new ApiError(400, 'A valid patient ID is required to mark a bed as OCCUPIED');
      }
      bed.patient = patient;
      bed.admittedAt = new Date();
      bed.releasedAt = null;
    }

    // Leaving OCCUPIED means the patient is no longer using the bed.
    if (bed.status === 'OCCUPIED' && status !== 'OCCUPIED') {
      bed.releasedAt = new Date();
      bed.patient = null;
    }

    bed.status = status;
    await bed.save();

    emitBedUpdate(req.app.get('io'), bed.ward, {
      bedId: bed._id.toString(),
      status: bed.status,
    });

    return sendSuccess(res, 200, 'Bed status updated successfully', { bed });
  } catch (error) {
    next(error);
  }
};
