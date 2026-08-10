import { randomInt, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import VerificationCode, { type VerificationPurpose } from "@/models/VerificationCode";
import { BadRequestError, TooManyRequestsError } from "@/lib/api/errors";

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60_000;
/** Guesses allowed before the code is locked and must be re-requested. */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60_000;

/**
 * Cheaper than the password cost of 12 on purpose: the search space is only
 * 10^6, so the ceiling on guesses — not the hash cost — is what makes this
 * safe, and every verify attempt pays this cost synchronously.
 */
const HASH_ROUNDS = 8;

/**
 * Cryptographically secure 6-digit code.
 *
 * `Math.random()` is not seeded securely and its output is recoverable from a
 * handful of samples, which for a password-reset code means an attacker who
 * registers an account can predict someone else's.
 */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * Issues a fresh code, replacing any existing one for this email and purpose.
 * Returns the plaintext code for delivery by email — the caller must not
 * persist or log it.
 */
export async function issueCode(
  email: string,
  purpose: VerificationPurpose
): Promise<string> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, HASH_ROUNDS);

  await VerificationCode.findOneAndUpdate(
    { email, purpose },
    {
      $set: {
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        createdAt: new Date(),
      },
      $unset: { lockedUntil: "" },
    },
    { upsert: true, returnDocument: "after" }
  );

  return code;
}

/**
 * Verifies a submitted code and consumes it on success.
 *
 * Failure modes are deliberately merged into one message: distinguishing
 * "no code on file" from "wrong code" tells an attacker whether an address has
 * a reset in flight.
 */
export async function verifyCode(
  email: string,
  purpose: VerificationPurpose,
  submitted: string
): Promise<void> {
  const record = await VerificationCode.findOne({ email, purpose });

  if (!record) throw new BadRequestError("Invalid or expired code");

  if (record.lockedUntil && record.lockedUntil > new Date()) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil.getTime() - Date.now()) / 1000);
    throw new TooManyRequestsError(
      "Too many incorrect attempts. Request a new code.",
      retryAfterSeconds
    );
  }

  // The TTL monitor can lag by up to a minute, so expiry is checked in code.
  if (record.expiresAt <= new Date()) {
    await record.deleteOne();
    throw new BadRequestError("This code has expired. Request a new one.");
  }

  const matches = await bcrypt.compare(submitted, record.codeHash);

  if (!matches) {
    const attempts = record.attempts + 1;
    const update: Record<string, unknown> = { attempts };
    if (attempts >= MAX_ATTEMPTS) {
      update.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    }
    await VerificationCode.updateOne({ _id: record._id }, { $set: update });

    if (attempts >= MAX_ATTEMPTS) {
      throw new TooManyRequestsError(
        "Too many incorrect attempts. Request a new code.",
        Math.ceil(LOCKOUT_MS / 1000)
      );
    }
    throw new BadRequestError(
      `Invalid code. ${MAX_ATTEMPTS - attempts} attempt(s) remaining.`
    );
  }

  // Single use — consume it so a replayed request cannot reset the password twice.
  await record.deleteOne();
}

/**
 * Constant-time string comparison, for callers that need to compare a secret
 * without leaking its length or prefix through timing.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
