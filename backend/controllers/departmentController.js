import mongoose from 'mongoose';
import Department from '../models/Department.js';
import { sendSuccess, ApiError } from '../utils/apiResponse.js';

/**
 * @route   GET /api/departments
 * @desc    List all departments. Patients/doctors see only active ones;
 *          admins can pass ?includeInactive=true to see everything.
 * @access  Public (any authenticated role)
 */
export const getDepartments = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true' && req.user?.role === 'ADMIN';
    const filter = includeInactive ? {} : { isActive: true };

    const departments = await Department.find(filter).sort({ name: 1 });

    return sendSuccess(res, 200, 'Departments fetched successfully', { departments });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/departments/:id
 * @access  Public (any authenticated role)
 */
export const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid department ID');
    }

    const department = await Department.findById(id);
    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    return sendSuccess(res, 200, 'Department fetched successfully', { department });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/departments
 * @access  Private/Admin
 */
export const createDepartment = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const existing = await Department.findOne({ name: name.trim() });
    if (existing) {
      throw new ApiError(409, 'A department with this name already exists');
    }

    const department = await Department.create({ name, description });

    return sendSuccess(res, 201, 'Department created successfully', { department });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/departments/:id
 * @access  Private/Admin
 */
export const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid department ID');
    }

    const { name, description, isActive } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;

    const department = await Department.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    return sendSuccess(res, 200, 'Department updated successfully', { department });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/departments/:id
 * @desc    Soft-delete: sets isActive=false rather than removing the
 *          document, since Doctors/Appointments/QueueTokens reference it.
 * @access  Private/Admin
 */
export const deactivateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid department ID');
    }

    const department = await Department.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    return sendSuccess(res, 200, 'Department deactivated successfully', { department });
  } catch (error) {
    next(error);
  }
};
