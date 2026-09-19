import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one Doctor profile per User account
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true,
    },
    licenseNumber: {
      type: String,
      required: [true, 'License number is required'],
      unique: true,
      trim: true,
    },
    experience: {
      type: Number, // years
      min: 0,
      default: 0,
    },
    consultationRoom: {
      type: String,
      trim: true,
      default: '',
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    // used by the wait-time calculator: peopleAhead * averageConsultationTime
    averageConsultationTime: {
      type: Number, // minutes
      min: [1, 'Average consultation time must be at least 1 minute'],
      default: 10,
    },
  },
  { timestamps: true }
);

doctorSchema.index({ department: 1 });

const Doctor = mongoose.model('Doctor', doctorSchema);

export default Doctor;
