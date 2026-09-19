import mongoose from 'mongoose';

const bedSchema = new mongoose.Schema(
  {
    bedNumber: {
      type: String,
      required: [true, 'Bed number is required'],
      trim: true,
    },
    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ward',
      required: true,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'],
      default: 'AVAILABLE',
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    admittedAt: {
      type: Date,
      default: null,
    },
    releasedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// A bed number must be unique within its ward (not globally).
bedSchema.index({ ward: 1, bedNumber: 1 }, { unique: true });
bedSchema.index({ status: 1 });

const Bed = mongoose.model('Bed', bedSchema);

export default Bed;
