/**
 * Calculates estimated waiting time in minutes.
 *
 * estimatedWaitTime = peopleAhead * averageConsultationTime
 *
 * Kept as a standalone, pure function so both the booking flow and the
 * live token-status endpoint compute wait time identically.
 */
const calculateWaitTime = (peopleAhead, averageConsultationTime) => {
  const ahead = Number(peopleAhead) || 0;
  const avgTime = Number(averageConsultationTime) || 0;
  return Math.max(0, ahead) * Math.max(0, avgTime);
};

export default calculateWaitTime;
