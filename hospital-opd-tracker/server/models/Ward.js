import mongoose from 'mongoose';
const schema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, code: { type: String, required: true, uppercase: true, trim: true }, location: { type: String, trim: true }, active: { type: Boolean, default: true } }, { timestamps: true });
schema.index({ code: 1 }, { unique: true });
export default mongoose.model('Ward', schema);
