import mongoose from 'mongoose';

/**
 * Generic atomic counter, used to generate race-condition-safe,
 * per-department-per-day sequential queue token numbers.
 *
 * key format: "<departmentId>_<YYYY-MM-DD>"
 *
 * We deliberately do NOT compute "count existing tokens + 1" to get the
 * next token number — under concurrent booking requests that pattern can
 * hand out the same number twice. findOneAndUpdate with $inc is atomic
 * at the MongoDB level and safe under concurrency.
 */
const counterSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;
