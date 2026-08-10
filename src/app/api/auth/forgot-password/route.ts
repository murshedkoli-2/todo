import { handler, parseBody } from "@/lib/api/route";
import { forgotPasswordSchema } from "@/lib/schemas/auth";
import { AUTH_LIMITS, clientIp, enforceRateLimits } from "@/lib/rateLimit";
import { requestPasswordReset } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export const POST = handler(
  async ({ request }) => {
    const { email } = await parseBody(request, forgotPasswordSchema);

    await enforceRateLimits([
      { key: `forgot:ip:${clientIp(request)}`, rule: AUTH_LIMITS.sendPerIp },
      { key: `forgot:email:${email}`, rule: AUTH_LIMITS.sendPerEmail },
    ]);

    // Always acknowledges, registered or not — see `auth.service`.
    return { ...(await requestPasswordReset(email)), email };
  },
  { public: true }
);
