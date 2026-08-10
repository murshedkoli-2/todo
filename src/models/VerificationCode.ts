import mongoose, { Schema, Document, Model } from "mongoose";

export type VerificationPurpose = "email_verification" | "password_reset";

/**
 * A single-use, hashed, attempt-limited verification code.
 *
 * Replaces the former `Otp` and `PasswordResetToken` collections, which were
 * byte-identical apart from the field name and stored their codes in plaintext
 * with no attempt ceiling — a 6-digit code with unlimited guesses is a
 * ten-minute brute force.
 */
export interface IVerificationCode extends Document {
  email: string;
  purpose: VerificationPurpose;
  /** bcrypt hash of the 6-digit code. The code itself is never persisted. */
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  /** Set once `attempts` hits the ceiling; blocks further guesses. */
  lockedUntil?: Date;
  createdAt: Date;
}

const VerificationCodeSchema = new Schema<IVerificationCode>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: {
      type: String,
      enum: ["email_verification", "password_reset"],
      required: true,
    },
    codeHash: { type: String, required: true },
    attempts: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    lockedUntil: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/** One live code per email per purpose — requesting a new one replaces the old. */
VerificationCodeSchema.index({ email: 1, purpose: 1 }, { unique: true });

const VerificationCode: Model<IVerificationCode> =
  mongoose.models.VerificationCode ||
  mongoose.model<IVerificationCode>("VerificationCode", VerificationCodeSchema);

export default VerificationCode;
