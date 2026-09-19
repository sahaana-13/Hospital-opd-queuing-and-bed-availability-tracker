import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Doctor from '../models/Doctor.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import { sendSuccess, ApiError } from '../utils/apiResponse.js';

/**
 * @route   GET /api/doctors
 * @desc    List doctors, optionally filtered by department.
 *          Query: ?department=<departmentId>&available=true
 * @access  Public (any authenticated role)
 */
export const getDoctors = async (req, res, next) => {
  try {
    const { department, available } = req.query;
    const filter = {};

    if (department) {
      if (!mongoose.Types.ObjectId.isValid(department)) {
        throw new ApiError(400, 'Invalid department ID');
      }
      filter.department = department;
    }

    if (available === 'true') {
      filter.isAvailable = true;
    }

    const doctors = await Doctor.find(filter)
      .populate('user', 'name email phone')
      .populate('department', 'name')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Doctors fetched successfully', { doctors });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/doctors/:id
 * @access  Public (any authenticated role)
 */
export const getDoctorById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid doctor ID');
    }

    const doctor = await Doctor.findById(id)
      .populate('user', 'name email phone')
      .populate('department', 'name');

    if (!doctor) {
      throw new ApiError(404, 'Doctor not found');
    }

    return sendSuccess(res, 200, 'Doctor fetched successfully', { doctor });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/doctor/profile
 * @desc    The logged-in doctor's own profile + assigned department.
 * @access  Private/Doctor
 */
export const getMyDoctorProfile = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id })
      .populate('user', 'name email phone')
      .populate('department', 'name description');

    if (!doctor) {
      throw new ApiError(404, 'Doctor profile not found for this account');
    }

    return sendSuccess(res, 200, 'Doctor profile fetched successfully', { doctor });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/admin/doctors
 * @desc    Admin creates a doctor account: creates the underlying User
 *          (role=DOCTOR) and the Doctor profile in one operation.
 * @access  Private/Admin
 */
export const createDoctor = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const {
      name,
      email,
      password,
      phone,
      age,
      gender,
      department,
      specialization,
      licenseNumber,
      experience,
      consultationRoom,
      averageConsultationTime,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(department)) {
      throw new ApiError(400, 'Invalid department ID');
    }

    const departmentDoc = await Department.findById(department).session(session);
    if (!departmentDoc) {
      throw new ApiError(404, 'Department not found');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() }).session(session);
    if (existingUser) {
      throw new ApiError(409, 'An account with this email already exists');
    }

    const existingLicense = await Doctor.findOne({ licenseNumber }).session(session);
    if (existingLicense) {
      throw new ApiError(409, 'A doctor with this license number already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userDocs = await User.create(
      [
        {
          name,
          email,
          password: hashedPassword,
          phone,
          age,
          gender,
          role: 'DOCTOR',
        },
      ],
      { session }
    );
    const user = userDocs[0];

    const doctorDocs = await Doctor.create(
      [
        {
          user: user._id,
          department,
          specialization,
          licenseNumber,
          experience,
          consultationRoom,
          averageConsultationTime,
        },
      ],
      { session }
    );
    const doctor = doctorDocs[0];

    await session.commitTransaction();
    session.endSession();

    const populatedDoctor = await Doctor.findById(doctor._id)
      .populate('user', 'name email phone')
      .populate('department', 'name');

    return sendSuccess(res, 201, 'Doctor created successfully', { doctor: populatedDoctor });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * @route   PATCH /api/admin/doctors/:id
 * @desc    Admin updates a doctor's profile fields (not credentials).
 * @access  Private/Admin
 */
export const updateDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid doctor ID');
    }

    const allowedFields = [
      'department',
      'specialization',
      'experience',
      'consultationRoom',
      'isAvailable',
      'averageConsultationTime',
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (updates.department && !mongoose.Types.ObjectId.isValid(updates.department)) {
      throw new ApiError(400, 'Invalid department ID');
    }

    const doctor = await Doctor.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('user', 'name email phone')
      .populate('department', 'name');

    if (!doctor) {
      throw new ApiError(404, 'Doctor not found');
    }

    return sendSuccess(res, 200, 'Doctor updated successfully', { doctor });
  } catch (error) {
    next(error);
  }
};
