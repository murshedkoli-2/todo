import { handler, parseBody } from "@/lib/api/route";
import { resetPasswordSchema } from "@/lib/schemas/auth";
import { AUTH_LIMITS, clientIp, enforceRateLimits } from "@/lib/rateLimit";
import { resetPassword } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export const POST = handler(
  async ({ request }) => {
    const input = await parseBody(request, resetPasswordSchema);

    await enforceRateLimits([
      { key: `reset:ip:${clientIp(request)}`, rule: AUTH_LIMITS.verifyPerIp },
      { key: `reset:email:${input.email}`, rule: AUTH_LIMITS.verifyPerEmail },
    ]);

    return resetPassword(input);
  },
  { public: true }
);
