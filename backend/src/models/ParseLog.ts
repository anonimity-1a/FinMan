import { Schema, model } from 'mongoose';

export const PARSE_LOG_TTL_DAYS = 30;

// One row per AI parse. MongoDB's TTL monitor deletes rows 30 days after createdAt,
// so the log never needs a cleanup job.
const parseLogSchema = new Schema({
  model: { type: String, required: true },
  kind: { type: String, enum: ['text', 'image'], required: true },
  ok: { type: Boolean, required: true },
  ms: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

parseLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: PARSE_LOG_TTL_DAYS * 86_400 });

export const ParseLog = model('ParseLog', parseLogSchema);
