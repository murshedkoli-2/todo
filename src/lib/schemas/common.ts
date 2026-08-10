import { z } from "zod";
import { MAX_MINOR } from "@/lib/money";

/** 24-character hex string — a MongoDB ObjectId. */
export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier");

/**
 * A user-entered amount in **major** units. Kept as a string-or-number because
 * `<input type="number">` sends a string; the transform lands on integer minor
 * units so nothing downstream ever sees a float.
 */
export const positiveAmount = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const parsed = typeof value === "string" ? Number(value.trim()) : value;
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount must be a number" });
      return z.NEVER;
    }
    if (parsed <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount must be greater than zero" });
      return z.NEVER;
    }
    const minor = Math.round(parsed * 100);
    if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount is too large" });
      return z.NEVER;
    }
    return minor;
  });

/** Same as {@link positiveAmount} but allows zero — used for opening balances. */
export const nonNegativeAmount = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const parsed = typeof value === "string" ? Number(value.trim()) : value;
    if (!Number.isFinite(parsed) || parsed < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount cannot be negative" });
      return z.NEVER;
    }
    const minor = Math.round(parsed * 100);
    if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount is too large" });
      return z.NEVER;
    }
    return minor;
  });

/** Trims, then treats an empty string as "not provided". */
export const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Cannot exceed ${max} characters`)
    .transform((value) => value.trim())
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional();

export const requiredText = (max: number, label = "This field") =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, `${label} is required`)
        .max(max, `${label} cannot exceed ${max} characters`)
    );

/** ISO date string or `YYYY-MM-DD` from a date input. */
export const dateInput = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
      return z.NEVER;
    }
    return parsed;
  });

export const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Currency must be a 3-letter code")
  .transform((value) => value.toUpperCase());

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

/**
 * Password floor. Six characters was the previous rule and is below any
 * current guidance; eight with a length-only check follows NIST SP 800-63B,
 * which favours length over composition rules.
 */
export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long");

export const otpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;
