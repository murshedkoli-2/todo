import { z } from "zod";
import { email, otpCode, password, requiredText } from "@/lib/schemas/common";

export const registerSchema = z
  .object({
    name: requiredText(80, "Name"),
    email,
    password,
  })
  .strict();

export const verifyOtpSchema = z.object({ email, otp: otpCode }).strict();

export const resendOtpSchema = z.object({ email }).strict();

export const forgotPasswordSchema = z.object({ email }).strict();

export const resetPasswordSchema = z
  .object({
    email,
    code: otpCode,
    password,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
