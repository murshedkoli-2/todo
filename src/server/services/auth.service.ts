import bcrypt from "bcryptjs";
import User from "@/models/User";
import { issueCode, verifyCode } from "@/lib/otp";
import { sendOtpEmail, sendPasswordResetEmail } from "@/lib/mail";
import { BadRequestError, UpstreamError } from "@/lib/api/errors";
import type {
  RegisterInput, ResetPasswordInput,
} from "@/lib/schemas/auth";

const PASSWORD_ROUNDS = 12;

/**
 * Generic acknowledgement used by every endpoint that takes an email address.
 *
 * Telling the caller whether an address is registered — as the old
 * forgot-password route did with a 404 — turns the endpoint into a user
 * enumeration oracle. The response is identical either way; only the presence
 * of an email in the inbox differs.
 */
const ACKNOWLEDGED = {
  success: true,
  message: "If that email is registered, a verification code is on its way.",
} as const;

export async function register({ name, email, password }: RegisterInput) {
  const existing = await User.findOne({ email });

  if (existing?.emailVerified) {
    // An address that is already verified is public knowledge to whoever owns
    // it, and registration must fail loudly or the user gets no feedback.
    throw new BadRequestError("Email is already in use");
  }

  const hashedPassword = await bcrypt.hash(password, PASSWORD_ROUNDS);

  if (existing) {
    // Unverified signup being retried — overwrite rather than reject, so a
    // typo'd password on the first attempt is not a permanent dead end.
    existing.name = name;
    existing.password = hashedPassword;
    await existing.save();
  } else {
    await User.create({ name, email, password: hashedPassword, emailVerified: false });
  }

  const code = await issueCode(email, "email_verification");
  const delivered = await sendOtpEmail(email, code);
  if (!delivered) throw new UpstreamError("Could not send the verification email.");

  return { success: true, message: "Verification code sent.", email };
}

export async function verifyEmail(email: string, code: string) {
  await verifyCode(email, "email_verification", code);

  const user = await User.findOneAndUpdate(
    { email },
    { $set: { emailVerified: true } },
    { returnDocument: "after" }
  );
  if (!user) throw new BadRequestError("Invalid or expired code");

  return { success: true, message: "Email verified. You can now log in." };
}

export async function resendVerification(email: string) {
  const user = await User.findOne({ email });

  // Silently no-ops for unknown or already-verified addresses so the response
  // cannot be used to probe the user table.
  if (user && !user.emailVerified) {
    const code = await issueCode(email, "email_verification");
    const delivered = await sendOtpEmail(email, code);
    if (!delivered) throw new UpstreamError("Could not send the verification email.");
  }

  return ACKNOWLEDGED;
}

export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email });

  if (user?.emailVerified) {
    const code = await issueCode(email, "password_reset");
    const delivered = await sendPasswordResetEmail(email, code);
    if (!delivered) throw new UpstreamError("Could not send the reset email.");
  }

  return ACKNOWLEDGED;
}

export async function resetPassword({ email, code, password }: ResetPasswordInput) {
  // Throws on a bad code, and consumes it on success so it cannot be replayed.
  await verifyCode(email, "password_reset", code);

  const hashedPassword = await bcrypt.hash(password, PASSWORD_ROUNDS);
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { password: hashedPassword } },
    { returnDocument: "after" }
  );
  if (!user) throw new BadRequestError("Invalid or expired code");

  return {
    success: true,
    message: "Password reset. You can now log in with your new password.",
  };
}
