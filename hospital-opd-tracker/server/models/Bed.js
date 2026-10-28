import mongoose from 'mongoose';
const schema = new mongoose.Schema({ bedNumber: { type: String, required: true, trim: true, uppercase: true }, ward: { type: mongoose.Schema.Types.ObjectId, ref: 'Ward', required: true, index: true }, bedType: { type: String, trim: true, default: 'Standard' }, status: { type: String, enum: ['AVAILABLE','OCCUPIED','RESERVED','MAINTENANCE','UNAVAILABLE'], default: 'AVAILABLE', index: true }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, note: { type: String, maxlength: 250 }, statusUpdatedAt: { type: Date, default: Date.now } }, { timestamps: true });
schema.index({ ward: 1, bedNumber: 1 }, { unique: true });
export default mongoose.model('Bed', schema);
