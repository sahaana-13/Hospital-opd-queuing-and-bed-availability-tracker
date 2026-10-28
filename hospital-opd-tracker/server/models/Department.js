import mongoose from 'mongoose';
const schema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, code: { type: String, required: true, uppercase: true, trim: true, unique: true }, description: { type: String, trim: true, maxlength: 500 }, active: { type: Boolean, default: true }, defaultConsultationMinutes: { type: Number, default: 10, min: 1, max: 120 }, doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] }, { timestamps: true });
export default mongoose.model('Department', schema);
