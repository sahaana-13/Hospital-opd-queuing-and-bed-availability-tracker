import mongoose from 'mongoose';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Doctor from '../models/Doctor.js';
import Appointment from '../models/Appointment.js';
import QueueToken from '../models/QueueToken.js';
import Ward from '../models/Ward.js';
import Bed from '../models/Bed.js';
import { normalizeToDateOnly } from '../utils/generateQueueToken.js';
import { sendSuccess, ApiError } from '../utils/apiResponse.js';

// ---------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------

/**
 * @route   GET /api/admin/users
 * @desc    List all users, optionally filtered by ?role=PATIENT|DOCTOR|ADMIN
 * @access  Private/Admin
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    const filter = {};

    if (role) {
      const validRoles = ['PATIENT', 'DOCTOR', 'ADMIN'];
      if (!validRoles.includes(role)) {
        throw new ApiError(400, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }
      filter.role = role;
    }

    // password excluded automatically (select:false on schema)
    const users = await User.find(filter).sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Users fetched successfully', { users });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 */
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    const user = await User.findById(id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return sendSuccess(res, 200, 'User fetched successfully', { user });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/admin/users/:id/status
 * @desc    Activate or deactivate a user account (soft "delete").
 *          Body: { isActive: boolean }
 * @access  Private/Admin
 */
export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid user ID');
    }
    if (typeof isActive !== 'boolean') {
      throw new ApiError(400, 'isActive must be a boolean');
    }

    if (id === req.user._id.toString()) {
      throw new ApiError(400, 'You cannot change your own account status');
    }

    const user = await User.findByIdAndUpdate(id, { isActive }, { new: true });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return sendSuccess(res, 200, 'User status updated successfully', { user });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------
// Oversight: appointments & queues across the whole hospital
// ---------------------------------------------------------------------

/**
 * @route   GET /api/admin/appointments
 * @desc    View all appointments. Filterable by ?status=&department=&date=
 * @access  Private/Admin
 */
export const getAllAppointments = async (req, res, next) => {
  try {
    const { status, department, date } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (department) {
      if (!mongoose.Types.ObjectId.isValid(department)) {
        throw new ApiError(400, 'Invalid department ID');
      }
      filter.department = department;
    }
    if (date) {
      const dayStart = normalizeToDateOnly(new Date(date));
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      filter.appointmentDate = { $gte: dayStart, $lt: dayEnd };
    }

    const appointments = await Appointment.find(filter)
      .populate('patient', 'name phone')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name' } })
      .populate('department', 'name')
      .sort({ appointmentDate: -1 });

    return sendSuccess(res, 200, 'Appointments fetched successfully', { appointments });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/admin/queues
 * @desc    Today's queue across every department, grouped by department.
 * @access  Private/Admin
 */
export const getAllQueues = async (req, res, next) => {
  try {
    const queueDate = normalizeToDateOnly(new Date());

    const tokens = await QueueToken.find({ queueDate })
      .populate('patient', 'name phone')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name' } })
      .populate('department', 'name')
      .sort({ department: 1, tokenNumber: 1 });

    const grouped = tokens.reduce((acc, token) => {
      const deptName = token.department.name;
      if (!acc[deptName]) acc[deptName] = [];
      acc[deptName].push(token);
      return acc;
    }, {});

    return sendSuccess(res, 200, "Today's queues fetched successfully", { queues: grouped });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------
// Dashboard & analytics
// ---------------------------------------------------------------------

/**
 * @route   GET /api/admin/dashboard
 * @desc    Hospital-wide stats for today, plus per-department and
 *          per-ward breakdowns.
 * @access  Private/Admin
 */
export const getDashboard = async (req, res, next) => {
  try {
    const queueDate = normalizeToDateOnly(new Date());

    const [
      patientsToday,
      waitingPatients,
      servingPatients,
      completedPatients,
      totalBeds,
      availableBeds,
      occupiedBeds,
    ] = await Promise.all([
      QueueToken.countDocuments({ queueDate }),
      QueueToken.countDocuments({ queueDate, status: 'WAITING' }),
      QueueToken.countDocuments({ queueDate, status: 'SERVING' }),
      QueueToken.countDocuments({ queueDate, status: 'COMPLETED' }),
      Bed.countDocuments({}),
      Bed.countDocuments({ status: 'AVAILABLE' }),
      Bed.countDocuments({ status: 'OCCUPIED' }),
    ]);

    // Per-department stats: waiting count, completed count, average wait time
    const departments = await Department.find({ isActive: true });
    const departmentStats = await Promise.all(
      departments.map(async (dept) => {
        const [waiting, completed, waitTimeAgg] = await Promise.all([
          QueueToken.countDocuments({ department: dept._id, queueDate, status: 'WAITING' }),
          QueueToken.countDocuments({ department: dept._id, queueDate, status: 'COMPLETED' }),
          QueueToken.aggregate([
            { $match: { department: dept._id, queueDate, status: 'WAITING' } },
            { $group: { _id: null, avgWait: { $avg: '$estimatedWaitTime' } } },
          ]),
        ]);

        return {
          department: dept.name,
          waitingPatients: waiting,
          averageWaitTime: waitTimeAgg[0] ? Math.round(waitTimeAgg[0].avgWait) : 0,
          completedPatients: completed,
        };
      })
    );

    // Per-ward bed stats
    const wards = await Ward.find({ isActive: true });
    const bedStats = await Promise.all(
      wards.map(async (ward) => {
        const counts = await Bed.aggregate([
          { $match: { ward: ward._id } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const byStatus = counts.reduce((acc, c) => {
          acc[c._id] = c.count;
          return acc;
        }, {});
        const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

        return {
          ward: ward.name,
          total,
          available: byStatus.AVAILABLE || 0,
          occupied: byStatus.OCCUPIED || 0,
          reserved: byStatus.RESERVED || 0,
          cleaning: byStatus.CLEANING || 0,
        };
      })
    );

    return sendSuccess(res, 200, 'Dashboard data fetched successfully', {
      patientsToday,
      waitingPatients,
      servingPatients,
      completedPatients,
      availableBeds,
      occupiedBeds,
      totalBeds,
      departmentStats,
      bedStats,
    });
  } catch (error) {
    next(error);
  }
};
