import { handler, parseBody } from "@/lib/api/route";
import { registerSchema } from "@/lib/schemas/auth";
import { AUTH_LIMITS, clientIp, enforceRateLimits } from "@/lib/rateLimit";
import { register } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export const POST = handler(
  async ({ request }) => {
    const input = await parseBody(request, registerSchema);

    await enforceRateLimits([
      { key: `register:ip:${clientIp(request)}`, rule: AUTH_LIMITS.registerPerIp },
      { key: `register:email:${input.email}`, rule: AUTH_LIMITS.sendPerEmail },
    ]);

    return register(input);
  },
  { public: true }
);
