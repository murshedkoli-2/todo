import { handler, parseParams } from "@/lib/api/route";
import { txIdParam } from "@/lib/schemas/wallet";
import { deleteTransaction } from "@/server/services/wallet.service";

export const dynamic = "force-dynamic";

type Params = { walletId: string; txId: string };

export const DELETE = handler<Params>(async ({ userId, params }) => {
  const { walletId, txId } = parseParams(params, txIdParam);
  return deleteTransaction(userId, walletId, txId);
});
