import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Fixed-window rate-limit counter.
 *
 * Backed by Mongo rather than Redis so there is no extra service to run — the
 * app already has a connection, and auth endpoints are low-traffic enough that
 * one upsert per attempt is cheap. `_id` is the composite `key:windowStart`,
 * which makes the increment a single atomic upsert with no read first.
 */
export interface IRateLimit extends Document<string> {
  _id: string;
  count: number;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    // Mongo's TTL monitor sweeps roughly once a minute, so expired windows can
    // linger briefly. Callers compare against `expiresAt` themselves.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { versionKey: false, _id: false }
);

const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);

export default RateLimit;
