import mongoose from 'mongoose';

const wardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ward name is required'],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['GENERAL', 'ICU', 'EMERGENCY', 'PRIVATE', 'SEMI_PRIVATE'],
      required: true,
    },
    totalBeds: {
      type: Number,
      required: true,
      min: [0, 'Total beds cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Ward = mongoose.model('Ward', wardSchema);

export default Ward;
