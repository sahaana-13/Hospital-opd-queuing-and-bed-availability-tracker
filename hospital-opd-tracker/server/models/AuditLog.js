import mongoose from 'mongoose';
const schema = new mongoose.Schema({ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, action: { type: String, required: true }, resourceType: { type: String, required: true }, resourceId: mongoose.Schema.Types.ObjectId, metadata: { type: mongoose.Schema.Types.Mixed } }, { timestamps: true });
export default mongoose.model('AuditLog', schema);
