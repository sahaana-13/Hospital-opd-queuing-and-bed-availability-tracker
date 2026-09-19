import mongoose from 'mongoose';

const queueTokenSchema = new mongoose.Schema(
  {
    tokenNumber: {
      type: Number,
      required: true,
      // resets per department/day — see Counter.js. NOT globally unique,
      // uniqueness is scoped via the compound index below.
    },
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
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
    },
    status: {
      type: String,
      enum: ['WAITING', 'SERVING', 'COMPLETED', 'CANCELLED', 'SKIPPED'],
      default: 'WAITING',
    },
    // Calendar day this token belongs to (normalized to midnight UTC),
    // independent of appointmentDate's precise time, so "today's queue"
    // queries are a simple equality match.
    queueDate: {
      type: Date,
      required: true,
    },
    calledAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    estimatedWaitTime: {
      type: Number, // minutes
      default: 0,
    },
  },
  { timestamps: true }
);

// Token numbers are scoped per department per day.
queueTokenSchema.index({ department: 1, queueDate: 1, tokenNumber: 1 }, { unique: true });

// Fast lookup of "today's queue for this doctor"
queueTokenSchema.index({ doctor: 1, queueDate: 1, status: 1 });

// Enforce: only ONE token can be SERVING for a given doctor at a time.
// Partial unique index — only applies to documents where status === 'SERVING'.
queueTokenSchema.index(
  { doctor: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'SERVING' },
  }
);

const QueueToken = mongoose.model('QueueToken', queueTokenSchema);

export default QueueToken;
