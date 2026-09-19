import mongoose from 'mongoose';

// Statuses considered "active" for duplicate-prevention purposes.
// A patient can have at most one non-terminal appointment with the
// same doctor on the same day.
export const ACTIVE_APPOINTMENT_STATUSES = ['BOOKED', 'WAITING', 'SERVING'];

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['BOOKED', 'WAITING', 'SERVING', 'COMPLETED', 'CANCELLED', 'SKIPPED'],
      default: 'BOOKED',
    },
    queueToken: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueToken',
      default: null,
    },
  },
  { timestamps: true }
);

// Partial unique index: only enforced while status is one of the "active" set.
// This lets a patient re-book with the same doctor on the same day after
// a previous appointment was COMPLETED/CANCELLED/SKIPPED, while still
// blocking two simultaneously-active appointments (rule #19 in the spec).
appointmentSchema.index(
  { patient: 1, doctor: 1, appointmentDate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    },
  }
);

appointmentSchema.index({ doctor: 1, appointmentDate: 1, status: 1 });
appointmentSchema.index({ department: 1, appointmentDate: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
