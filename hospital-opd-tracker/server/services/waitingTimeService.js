import QueueToken from '../models/QueueToken.js';
import Department from '../models/Department.js';
const ACTIVE_AHEAD = ['WAITING','CALLED'];
export async function getEstimate(token) {
  const department = await Department.findById(token.department).select('defaultConsultationMinutes');
  if (!department) return { position: null, peopleAhead: null, estimatedWaitMinutes: null, averageConsultationMinutes: null };
  if (!ACTIVE_AHEAD.includes(token.status)) return { position: null, peopleAhead: 0, estimatedWaitMinutes: 0, averageConsultationMinutes: department.defaultConsultationMinutes };
  const ahead = await QueueToken.countDocuments({ department: token.department, serviceDate: token.serviceDate, sequence: { $lt: token.sequence }, status: { $in: ACTIVE_AHEAD } });
  return { position: ahead + 1, peopleAhead: ahead, estimatedWaitMinutes: Math.max(0, ahead * department.defaultConsultationMinutes), averageConsultationMinutes: department.defaultConsultationMinutes };
}
export async function attachEstimates(tokens) { return Promise.all(tokens.map(async (t) => ({ ...t.toObject(), estimate: await getEstimate(t) }))); }
