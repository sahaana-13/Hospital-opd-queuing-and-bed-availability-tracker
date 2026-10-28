import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['ADMIN','RECEPTIONIST','DOCTOR','PATIENT'], default: 'PATIENT', required: true },
  active: { type: Boolean, default: true },
  patientId: { type: String, unique: true, sparse: true },
  dateOfBirth: { type: Date }, contactNumber: { type: String, trim: true }, address: { type: String, trim: true, maxlength: 300 },
  staffId: { type: String, unique: true, sparse: true },
  departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }]
}, { timestamps: true });
userSchema.index({ name: 'text', patientId: 1, contactNumber: 1 });
export default mongoose.model('User', userSchema);
