import { handler, parseBody } from "@/lib/api/route";
import { verifyOtpSchema } from "@/lib/schemas/auth";
import { AUTH_LIMITS, clientIp, enforceRateLimits } from "@/lib/rateLimit";
import { verifyEmail } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export const POST = handler(
  async ({ request }) => {
    const { email, otp } = await parseBody(request, verifyOtpSchema);

    // Rate-limited before the code is checked, so the limiter — not the
    // 10^6 keyspace — is what bounds a brute force.
    await enforceRateLimits([
      { key: `verify:ip:${clientIp(request)}`, rule: AUTH_LIMITS.verifyPerIp },
      { key: `verify:email:${email}`, rule: AUTH_LIMITS.verifyPerEmail },
    ]);

    return verifyEmail(email, otp);
  },
  { public: true }
);
