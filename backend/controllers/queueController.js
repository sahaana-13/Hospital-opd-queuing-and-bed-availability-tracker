import mongoose from 'mongoose';
import Doctor from '../models/Doctor.js';
import Department from '../models/Department.js';
import Appointment from '../models/Appointment.js';
import QueueToken from '../models/QueueToken.js';
import { normalizeToDateOnly, getNextTokenNumber } from '../utils/generateQueueToken.js';
import calculateWaitTime from '../utils/calculateWaitTime.js';
import { emitQueueUpdate } from '../sockets/socketHandler.js';
import notifyUser from '../utils/notify.js';
import { sendSuccess, ApiError } from '../utils/apiResponse.js';

/**
 * Counts how many WAITING tokens are ahead of a given token number,
 * scoped to the same doctor + day (consultation order is per-doctor,
 * even though tokenNumber itself is scoped per-department).
 */
const countPeopleAhead = async (doctorId, queueDate, tokenNumber) => {
  return QueueToken.countDocuments({
    doctor: doctorId,
    queueDate,
    status: 'WAITING',
    tokenNumber: { $lt: tokenNumber },
  });
};

/**
 * Notifies patients near the front of a doctor's queue that their turn
 * is approaching. Called after any event that moves the queue forward
 * (call-next, complete, skip, cancel) since each of those changes
 * everyone else's peopleAhead count. Checks only the first few WAITING
 * tokens for efficiency — patients further back get their notification
 * once they cross the same threshold on a later check.
 */
const notifyApproachingPatients = async (io, doctorId, queueDate) => {
  const APPROACHING_THRESHOLD = 2; // notify when 2 or fewer people are ahead

  const upcoming = await QueueToken.find({ doctor: doctorId, queueDate, status: 'WAITING' })
    .sort({ tokenNumber: 1 })
    .limit(APPROACHING_THRESHOLD + 1);

  for (let i = 0; i < upcoming.length; i++) {
    const token = upcoming[i];
    const peopleAhead = i; // i tokens with a lower tokenNumber precede this one in `upcoming`
    if (peopleAhead <= APPROACHING_THRESHOLD) {
      await notifyUser(
        io,
        token.patient,
        'Your turn is approaching',
        `Your token #${token.tokenNumber} is approaching. There ${
          peopleAhead === 1 ? 'is' : 'are'
        } ${peopleAhead} patient${peopleAhead === 1 ? '' : 's'} ahead of you.`,
        'QUEUE_UPDATE'
      );
    }
  }
};

/**
 * @route   POST /api/queue/book
 * @desc    Patient books an OPD token with a specific doctor.
 * @access  Private/Patient
 */
export const bookToken = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { doctorId } = req.body;

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      throw new ApiError(400, 'A valid doctorId is required');
    }

    const doctor = await Doctor.findById(doctorId).populate('department');
    if (!doctor) {
      throw new ApiError(404, 'Doctor not found');
    }
    if (!doctor.isAvailable) {
      throw new ApiError(400, 'This doctor is not currently available for booking');
    }

    const queueDate = normalizeToDateOnly(new Date());
    let queueToken;
    let appointment;

    await session.withTransaction(async () => {
      // Guard against a patient double-booking the same doctor today.
      // The partial unique index on Appointment also enforces this at
      // the DB level; this check gives a clean 409 instead of a raw
      // duplicate-key error in the common case.
      const existingActive = await Appointment.findOne({
        patient: req.user._id,
        doctor: doctor._id,
        status: { $in: ['BOOKED', 'WAITING', 'SERVING'] },
      }).session(session);

      if (existingActive) {
        throw new ApiError(409, 'You already have an active appointment with this doctor today');
      }

      const appointmentDocs = await Appointment.create(
        [
          {
            patient: req.user._id,
            doctor: doctor._id,
            department: doctor.department._id,
            appointmentDate: new Date(),
            status: 'WAITING',
          },
        ],
        { session }
      );
      appointment = appointmentDocs[0];

      const tokenNumber = await getNextTokenNumber(doctor.department._id, queueDate, session);

      const peopleAhead = await countPeopleAhead(doctor._id, queueDate, tokenNumber);
      const estimatedWaitTime = calculateWaitTime(peopleAhead, doctor.averageConsultationTime);

      const tokenDocs = await QueueToken.create(
        [
          {
            tokenNumber,
            patient: req.user._id,
            doctor: doctor._id,
            department: doctor.department._id,
            appointment: appointment._id,
            status: 'WAITING',
            queueDate,
            estimatedWaitTime,
          },
        ],
        { session }
      );
      queueToken = tokenDocs[0];

      appointment.queueToken = queueToken._id;
      await appointment.save({ session });
    });

    const peopleAhead = await countPeopleAhead(doctor._id, queueDate, queueToken.tokenNumber);

    emitQueueUpdate(req.app.get('io'), doctor.department._id, {
      tokenNumber: queueToken.tokenNumber,
      status: queueToken.status,
      reason: 'booked',
    });

    await notifyUser(
      req.app.get('io'),
      req.user._id,
      'OPD token booked',
      `Your token #${queueToken.tokenNumber} for ${doctor.department.name} has been booked. Estimated wait: ${queueToken.estimatedWaitTime} minutes.`,
      'APPOINTMENT'
    );

    return sendSuccess(res, 201, 'OPD token booked successfully', {
      token: {
        id: queueToken._id,
        tokenNumber: queueToken.tokenNumber,
        department: doctor.department.name,
        doctor: doctor._id,
        status: queueToken.status,
        peopleAhead,
        estimatedWaitTime: queueToken.estimatedWaitTime,
      },
    });
  } catch (error) {
    // Duplicate-key from the partial unique index (race beat our pre-check)
    if (error.code === 11000) {
      return next(new ApiError(409, 'You already have an active appointment with this doctor today'));
    }
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @route   GET /api/queue/history
 * @desc    Patient's full appointment/token history (all statuses),
 *          newest first.
 * @access  Private/Patient
 */
export const getMyAppointmentHistory = async (req, res, next) => {
  try {
    const appointments = await Appointment.find({ patient: req.user._id })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name' } })
      .populate('department', 'name')
      .populate('queueToken', 'tokenNumber status')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Appointment history fetched successfully', { appointments });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/queue/my-token
 * @desc    Patient's currently active token (WAITING or SERVING), if any.
 * @access  Private/Patient
 */
export const getMyToken = async (req, res, next) => {
  try {
    const token = await QueueToken.findOne({
      patient: req.user._id,
      status: { $in: ['WAITING', 'SERVING'] },
    })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name' } })
      .populate('department', 'name')
      .sort({ createdAt: -1 });

    if (!token) {
      return sendSuccess(res, 200, 'No active token found', { token: null });
    }

    const peopleAhead =
      token.status === 'WAITING'
        ? await countPeopleAhead(token.doctor._id, token.queueDate, token.tokenNumber)
        : 0;

    return sendSuccess(res, 200, 'Active token fetched successfully', {
      token: {
        id: token._id,
        tokenNumber: token.tokenNumber,
        department: token.department.name,
        doctor: token.doctor.user.name,
        status: token.status,
        peopleAhead,
        estimatedWaitTime: token.estimatedWaitTime,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/queue/:departmentId
 * @desc    Today's queue for a department (display-board style — no
 *          patient-identifying info, just token numbers and status).
 * @access  Private (any authenticated role)
 */
export const getDepartmentQueue = async (req, res, next) => {
  try {
    const { departmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      throw new ApiError(400, 'Invalid department ID');
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    const queueDate = normalizeToDateOnly(new Date());

    const tokens = await QueueToken.find({ department: departmentId, queueDate })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name' } })
      .sort({ tokenNumber: 1 });

    const queue = tokens.map((t) => ({
      tokenNumber: t.tokenNumber,
      doctor: t.doctor.user.name,
      status: t.status,
    }));

    return sendSuccess(res, 200, "Today's department queue fetched successfully", {
      department: department.name,
      queue,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/queue/:tokenId/status
 * @access  Private (any authenticated role)
 */
export const getTokenStatus = async (req, res, next) => {
  try {
    const { tokenId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(tokenId)) {
      throw new ApiError(400, 'Invalid token ID');
    }

    const token = await QueueToken.findById(tokenId);
    if (!token) {
      throw new ApiError(404, 'Token not found');
    }

    // Patients may only check their own token's status.
    if (req.user.role === 'PATIENT' && token.patient.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'You are not authorized to view this token');
    }

    const currentServing = await QueueToken.findOne({
      doctor: token.doctor,
      queueDate: token.queueDate,
      status: 'SERVING',
    });

    const peopleAhead =
      token.status === 'WAITING'
        ? await countPeopleAhead(token.doctor, token.queueDate, token.tokenNumber)
        : 0;

    const estimatedWaitTime =
      token.status === 'WAITING'
        ? calculateWaitTime(
            peopleAhead,
            (await Doctor.findById(token.doctor)).averageConsultationTime
          )
        : token.estimatedWaitTime;

    return sendSuccess(res, 200, 'Token status fetched successfully', {
      currentServingToken: currentServing ? currentServing.tokenNumber : null,
      yourToken: token.tokenNumber,
      peopleAhead,
      estimatedWaitTime,
      status: token.status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/queue/cancel/:tokenId
 * @desc    Patient cancels their own token. Only WAITING tokens can be
 *          cancelled (can't cancel one already being served/done).
 * @access  Private/Patient
 */
export const cancelToken = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { tokenId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(tokenId)) {
      throw new ApiError(400, 'Invalid token ID');
    }

    let cancelledToken;

    await session.withTransaction(async () => {
      const token = await QueueToken.findById(tokenId).session(session);
      if (!token) {
        throw new ApiError(404, 'Token not found');
      }

      if (token.patient.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'You can only cancel your own token');
      }

      if (token.status !== 'WAITING') {
        throw new ApiError(400, `Cannot cancel a token with status ${token.status}`);
      }

      token.status = 'CANCELLED';
      await token.save({ session });

      await Appointment.findByIdAndUpdate(
        token.appointment,
        { status: 'CANCELLED' },
        { session }
      );

      cancelledToken = token;
    });

    emitQueueUpdate(req.app.get('io'), cancelledToken.department, {
      tokenNumber: cancelledToken.tokenNumber,
      status: 'CANCELLED',
      reason: 'cancelled',
    });

    await notifyApproachingPatients(
      req.app.get('io'),
      cancelledToken.doctor,
      cancelledToken.queueDate
    );

    return sendSuccess(res, 200, 'Token cancelled successfully', null);
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

// ---------------------------------------------------------------------
// Doctor-side queue operations
// ---------------------------------------------------------------------

/**
 * Resolves the Doctor profile for the currently logged-in DOCTOR user.
 * Shared by all doctor queue endpoints below.
 */
const getDoctorProfileOrThrow = async (userId, session) => {
  const query = Doctor.findOne({ user: userId });
  if (session) query.session(session);
  const doctor = await query;
  if (!doctor) {
    throw new ApiError(404, 'Doctor profile not found for this account');
  }
  return doctor;
};

/**
 * @route   GET /api/doctor/queue
 * @desc    Doctor's today's queue.
 * @access  Private/Doctor
 */
export const getDoctorQueue = async (req, res, next) => {
  try {
    const doctor = await getDoctorProfileOrThrow(req.user._id);
    const queueDate = normalizeToDateOnly(new Date());

    const tokens = await QueueToken.find({
      doctor: doctor._id,
      queueDate,
      status: { $in: ['WAITING', 'SERVING'] },
    })
      .populate('patient', 'name age gender phone')
      .sort({ tokenNumber: 1 });

    return sendSuccess(res, 200, "Today's queue fetched successfully", { queue: tokens });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/doctor/call-next
 * @desc    Moves the earliest WAITING token to SERVING.
 *          Atomic findOneAndUpdate + the partial unique index on
 *          (doctor, status:'SERVING') together guarantee only one
 *          patient is ever SERVING for this doctor, even under
 *          concurrent call-next requests.
 * @access  Private/Doctor
 */
export const callNextPatient = async (req, res, next) => {
  try {
    const doctor = await getDoctorProfileOrThrow(req.user._id);
    const queueDate = normalizeToDateOnly(new Date());

    const alreadyServing = await QueueToken.findOne({ doctor: doctor._id, status: 'SERVING' });
    if (alreadyServing) {
      throw new ApiError(
        409,
        `Token #${alreadyServing.tokenNumber} is already being served. Complete or skip it first.`
      );
    }

    // Atomic: only ever picks up ONE waiting token, even if this
    // endpoint is hit twice concurrently.
    const nextToken = await QueueToken.findOneAndUpdate(
      { doctor: doctor._id, queueDate, status: 'WAITING' },
      { $set: { status: 'SERVING', calledAt: new Date() } },
      { sort: { tokenNumber: 1 }, new: true }
    ).populate('patient', 'name age gender phone');

    if (!nextToken) {
      throw new ApiError(404, 'No patients waiting in the queue');
    }

    await Appointment.findByIdAndUpdate(nextToken.appointment, { status: 'SERVING' });

    emitQueueUpdate(req.app.get('io'), doctor.department, {
      tokenNumber: nextToken.tokenNumber,
      status: 'SERVING',
      reason: 'called-next',
    });

    const io = req.app.get('io');
    await notifyUser(
      io,
      nextToken.patient._id,
      "It's your turn!",
      `Token #${nextToken.tokenNumber}, please proceed to the consultation room.`,
      'YOUR_TURN'
    );
    await notifyApproachingPatients(io, doctor._id, queueDate);

    return sendSuccess(res, 200, 'Next patient called successfully', { token: nextToken });
  } catch (error) {
    // In the rare case two requests both pass the alreadyServing check
    // and race to the same $set, the partial unique index rejects the
    // loser with a duplicate-key error — surface it as a clean 409.
    if (error.code === 11000) {
      return next(new ApiError(409, 'Another patient is already being served'));
    }
    next(error);
  }
};

/**
 * @route   POST /api/doctor/:tokenId/complete
 * @desc    Moves a SERVING token to COMPLETED.
 * @access  Private/Doctor
 */
export const completeToken = async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tokenId)) {
      throw new ApiError(400, 'Invalid token ID');
    }

    const doctor = await getDoctorProfileOrThrow(req.user._id);

    const token = await QueueToken.findOne({ _id: tokenId, doctor: doctor._id });
    if (!token) {
      throw new ApiError(404, 'Token not found for this doctor');
    }
    if (token.status !== 'SERVING') {
      throw new ApiError(400, `Cannot complete a token with status ${token.status}`);
    }

    token.status = 'COMPLETED';
    token.completedAt = new Date();
    await token.save();

    await Appointment.findByIdAndUpdate(token.appointment, { status: 'COMPLETED' });

    emitQueueUpdate(req.app.get('io'), token.department, {
      tokenNumber: token.tokenNumber,
      status: 'COMPLETED',
      reason: 'completed',
    });

    await notifyApproachingPatients(req.app.get('io'), doctor._id, token.queueDate);

    return sendSuccess(res, 200, 'Patient marked as completed', { token });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/doctor/:tokenId/skip
 * @desc    Moves a WAITING token to SKIPPED (patient wasn't present
 *          when called, etc).
 * @access  Private/Doctor
 */
export const skipToken = async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tokenId)) {
      throw new ApiError(400, 'Invalid token ID');
    }

    const doctor = await getDoctorProfileOrThrow(req.user._id);

    const token = await QueueToken.findOne({ _id: tokenId, doctor: doctor._id });
    if (!token) {
      throw new ApiError(404, 'Token not found for this doctor');
    }
    if (token.status !== 'WAITING') {
      throw new ApiError(400, `Cannot skip a token with status ${token.status}`);
    }

    token.status = 'SKIPPED';
    await token.save();

    await Appointment.findByIdAndUpdate(token.appointment, { status: 'SKIPPED' });

    emitQueueUpdate(req.app.get('io'), token.department, {
      tokenNumber: token.tokenNumber,
      status: 'SKIPPED',
      reason: 'skipped',
    });

    await notifyApproachingPatients(req.app.get('io'), doctor._id, token.queueDate);

    return sendSuccess(res, 200, 'Patient skipped', { token });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/doctor/stats
 * @desc    Today's consultation statistics for the logged-in doctor.
 * @access  Private/Doctor
 */
export const getDoctorTodayStats = async (req, res, next) => {
  try {
    const doctor = await getDoctorProfileOrThrow(req.user._id);
    const queueDate = normalizeToDateOnly(new Date());

    const [waiting, serving, completed, skipped, cancelled] = await Promise.all([
      QueueToken.countDocuments({ doctor: doctor._id, queueDate, status: 'WAITING' }),
      QueueToken.countDocuments({ doctor: doctor._id, queueDate, status: 'SERVING' }),
      QueueToken.countDocuments({ doctor: doctor._id, queueDate, status: 'COMPLETED' }),
      QueueToken.countDocuments({ doctor: doctor._id, queueDate, status: 'SKIPPED' }),
      QueueToken.countDocuments({ doctor: doctor._id, queueDate, status: 'CANCELLED' }),
    ]);

    return sendSuccess(res, 200, "Today's statistics fetched successfully", {
      stats: { waiting, serving, completed, skipped, cancelled },
    });
  } catch (error) {
    next(error);
  }
};
