import { handler, parseBody, parseParams } from "@/lib/api/route";
import { updateAccountSchema, walletIdParam } from "@/lib/schemas/wallet";
import {
  deleteAccount, getAccountWithTransactions, updateAccount,
} from "@/server/services/wallet.service";

export const dynamic = "force-dynamic";

type Params = { walletId: string };

export const GET = handler<Params>(async ({ userId, params }) =>
  getAccountWithTransactions(userId, parseParams(params, walletIdParam).walletId)
);

export const PATCH = handler<Params>(async ({ userId, params, request }) =>
  updateAccount(
    userId,
    parseParams(params, walletIdParam).walletId,
    await parseBody(request, updateAccountSchema)
  )
);

export const DELETE = handler<Params>(async ({ userId, params }) => {
  await deleteAccount(userId, parseParams(params, walletIdParam).walletId);
  return { success: true };
});
