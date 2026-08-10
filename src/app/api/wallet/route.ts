import { handler, parseBody } from "@/lib/api/route";
import { createAccountSchema } from "@/lib/schemas/wallet";
import { createAccount, listAccounts } from "@/server/services/wallet.service";

export const dynamic = "force-dynamic";

export const GET = handler(async ({ userId }) => listAccounts(userId));

export const POST = handler(
  async ({ userId, request }) =>
    createAccount(userId, await parseBody(request, createAccountSchema)),
  { status: 201 }
);
