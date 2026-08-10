import RateLimit from "@/models/RateLimit";
import { TooManyRequestsError } from "@/lib/api/errors";

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Limits for the unauthenticated auth surface. Each endpoint is limited twice:
 * once per client IP and once per target email, so neither a single host
 * hammering many accounts nor a distributed attempt against one account gets
 * through.
 */
export const AUTH_LIMITS = {
  /** Code submission — the account-takeover path. Deliberately tight. */
  verifyPerIp: { limit: 10, windowMs: 10 * MINUTE },
  verifyPerEmail: { limit: 5, windowMs: 10 * MINUTE },

  /** Anything that sends an email; also protects the SMTP quota. */
  sendPerIp: { limit: 5, windowMs: HOUR },
  sendPerEmail: { limit: 3, windowMs: HOUR },

  /** Account creation. */
  registerPerIp: { limit: 10, windowMs: HOUR },
} satisfies Record<string, RateLimitRule>;

/**
 * Best-effort client address. `x-forwarded-for` is only trustworthy behind a
 * proxy that overwrites it (Vercel does); the value is a rate-limit bucket key,
 * never an authorization input, so a spoofed header costs the attacker their
 * own bucket rather than gaining them access.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Increments the counter for `key` and throws once the window's limit is
 * exceeded. Fixed-window rather than sliding: it allows a burst at a window
 * boundary, which is an acceptable trade for a single atomic upsert.
 */
export async function enforceRateLimit(
  key: string,
  { limit, windowMs }: RateLimitRule
): Promise<void> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);

  const record = await RateLimit.findByIdAndUpdate(
    `${key}:${windowStart}`,
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: "after" }
  ).lean();

  if ((record?.count ?? 1) > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000));
    throw new TooManyRequestsError(
      `Too many attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      retryAfterSeconds
    );
  }
}

/** Applies several rules at once — typically the per-IP and per-email pair. */
export async function enforceRateLimits(
  rules: ReadonlyArray<{ key: string; rule: RateLimitRule }>
): Promise<void> {
  for (const { key, rule } of rules) {
    await enforceRateLimit(key, rule);
  }
}
