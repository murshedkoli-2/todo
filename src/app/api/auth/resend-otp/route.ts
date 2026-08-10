import { handler, parseBody } from "@/lib/api/route";
import { resendOtpSchema } from "@/lib/schemas/auth";
import { AUTH_LIMITS, clientIp, enforceRateLimits } from "@/lib/rateLimit";
import { resendVerification } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export const POST = handler(
  async ({ request }) => {
    const { email } = await parseBody(request, resendOtpSchema);

    await enforceRateLimits([
      { key: `resend:ip:${clientIp(request)}`, rule: AUTH_LIMITS.sendPerIp },
      { key: `resend:email:${email}`, rule: AUTH_LIMITS.sendPerEmail },
    ]);

    return resendVerification(email);
  },
  { public: true }
);
