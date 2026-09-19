import Counter from '../models/Counter.js';

/**
 * Normalizes any Date to midnight UTC of that calendar day. Used as the
 * `queueDate` on QueueToken so "today's queue" is a simple equality
 * match instead of a $gte/$lt date-range query.
 */
export const normalizeToDateOnly = (date = new Date()) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Atomically generates the next sequential token number for a given
 * department on a given day.
 *
 * Uses findOneAndUpdate with $inc, which MongoDB executes as a single
 * atomic operation — safe under concurrent booking requests, unlike
 * "count existing tokens + 1" which can race and hand out duplicates.
 *
 * @param {ObjectId|string} departmentId
 * @param {Date} queueDate - already normalized via normalizeToDateOnly
 * @param {import('mongoose').ClientSession} [session]
 * @returns {Promise<number>} the newly assigned token number (starts at 1)
 */
export const getNextTokenNumber = async (departmentId, queueDate, session) => {
  const dateKey = queueDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `${departmentId.toString()}_${dateKey}`;

  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  return counter.seq;
};
