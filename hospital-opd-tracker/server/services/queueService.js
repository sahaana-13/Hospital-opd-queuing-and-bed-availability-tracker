import mongoose from 'mongoose';
import { VALID_TRANSITIONS, serviceDateFor } from './businessRules.js';
import QueueToken from '../models/QueueToken.js';
import Department from '../models/Department.js';
import { HttpError } from '../utils/httpError.js';
import { notifyUser } from './notificationService.js';
import { getEstimate } from './waitingTimeService.js';
export { VALID_TRANSITIONS, serviceDateFor };
export async function createToken({ patientId, departmentId, actor, note }) {
  const department = await Department.findOne({ _id: departmentId, active: true }); if (!department) throw new HttpError(400,'Select an active department.');
  const serviceDate = serviceDateFor();
  // A per-department/date counter is implemented using atomic counter documents in a future hardening step; the unique index protects integrity and duplicate-key retries handle concurrent collisions.
  for (let attempt=0; attempt<5; attempt++) {
    const last = await QueueToken.findOne({ department: departmentId, serviceDate }).sort({ sequence: -1 }).select('sequence');
    const sequence = (last?.sequence || 0) + 1; const tokenNumber = `${department.code}-${String(sequence).padStart(3,'0')}`;
    try { const token = await QueueToken.create({ tokenNumber, sequence, patient: patientId, department: departmentId, serviceDate, createdBy: actor._id, note });
      await notifyUser({ recipient: patientId, type:'QUEUE_CREATED', message:`Your OPD token ${tokenNumber} has been created.`, relatedResource:{ resourceType:'QueueToken', resourceId:token._id } });
      const event = { departmentId:String(departmentId), serviceDate, reason:'TOKEN_CREATED' }; globalThis.opdIO?.to(`department:${departmentId}`).emit('queue:updated',event); globalThis.opdIO?.to('staff:all').emit('queue:updated',event);
      return token;
    } catch (error) { if (error.code !== 11000 || attempt === 4) throw error; }
  }
}
export async function changeTokenStatus(token, status, actor, reason) {
  const previousStatus = token.status;
  if (!VALID_TRANSITIONS[previousStatus]?.includes(status)) throw new HttpError(409,`Cannot change token from ${previousStatus} to ${status}.`);
  if (status === 'CANCELLED' && !reason?.trim()) throw new HttpError(400,'A cancellation reason is required.');
  const now = new Date(); const updates = { status };
  if (status === 'CALLED') updates.calledAt = now;
  if (status === 'IN_CONSULTATION') { updates.consultationStartedAt = now; if (actor.role==='DOCTOR') updates.assignedDoctor = actor._id; }
  if (status === 'COMPLETED') updates.completedAt = now;
  if (status === 'CANCELLED') updates.cancellationReason = reason.trim();
  // Conditional update makes competing status changes fail rather than overwrite one another.
  const updated = await QueueToken.findOneAndUpdate({ _id: token._id, status: previousStatus }, { $set: updates }, { new: true, runValidators: true });
  if (!updated) throw new HttpError(409,'This token was updated by another staff member. Refresh the queue and try again.');
  const messages = { CALLED:`Your token ${updated.tokenNumber} has been called.`, IN_CONSULTATION:`Your consultation for ${updated.tokenNumber} has started.`, COMPLETED:`Your consultation for ${updated.tokenNumber} is complete.`, SKIPPED:`Your token ${updated.tokenNumber} was skipped. Please contact OPD staff.`, CANCELLED:`Your token ${updated.tokenNumber} was cancelled.`, WAITING:`Your token ${updated.tokenNumber} has returned to the waiting queue.` };
  await notifyUser({ recipient:updated.patient, type: status==='COMPLETED'?'CONSULTATION_COMPLETED':'QUEUE_UPDATED', message:messages[status], relatedResource:{ resourceType:'QueueToken', resourceId:updated._id } });
  const event = { departmentId:String(updated.department), serviceDate:updated.serviceDate, reason:status }; globalThis.opdIO?.to(`department:${updated.department}`).emit('queue:updated',event); globalThis.opdIO?.to('staff:all').emit('queue:updated',event);
  return updated;
}
export async function callNext(departmentId, actor) {
  const department = await Department.findOne({ _id: departmentId, active:true }); if (!department) throw new HttpError(404,'Department not found or inactive.');
  const today = serviceDateFor();
  // Atomic conditional update prevents two staff members calling the same token.
  const token = await QueueToken.findOneAndUpdate({ department:departmentId, serviceDate:today, status:'WAITING' }, { $set:{ status:'CALLED', calledAt:new Date(), ...(actor.role==='DOCTOR'?{assignedDoctor:actor._id}:{}) } }, { sort:{ sequence:1 }, new:true });
  if (!token) throw new HttpError(404,'No waiting tokens in this department.');
  await notifyUser({ recipient:token.patient, type:'TOKEN_CALLED', message:`Your token ${token.tokenNumber} has been called.`, relatedResource:{resourceType:'QueueToken',resourceId:token._id} });
  globalThis.opdIO?.to(`department:${departmentId}`).emit('queue:updated',{departmentId:String(departmentId),serviceDate:today,reason:'TOKEN_CALLED'}); return token;
}
export { getEstimate };
