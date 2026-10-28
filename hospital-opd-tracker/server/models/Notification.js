import mongoose from 'mongoose';
const schema = new mongoose.Schema({ recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, type: { type: String, enum: ['QUEUE_CREATED','QUEUE_UPDATED','TOKEN_CALLED','CONSULTATION_COMPLETED','BED_UPDATED','SYSTEM'], default: 'SYSTEM' }, message: { type: String, required: true, maxlength: 300 }, relatedResource: { resourceType: String, resourceId: mongoose.Schema.Types.ObjectId }, readAt: Date }, { timestamps: true });
schema.index({ recipient: 1, createdAt: -1 });
export default mongoose.model('Notification', schema);
