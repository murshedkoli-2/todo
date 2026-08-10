import { handler, parseParams } from "@/lib/api/route";
import { walletIdParam } from "@/lib/schemas/wallet";
import { recomputeBalance } from "@/server/services/wallet.service";

export const dynamic = "force-dynamic";

type Params = { walletId: string };

/**
 * Rebuilds the cached balance from the transaction ledger.
 *
 * Reconciliation escape hatch for balances written before the atomic-`$inc`
 * change, or by the non-transactional development fallback.
 */
export const POST = handler<Params>(async ({ userId, params }) => {
  const balanceMinor = await recomputeBalance(
    userId,
    parseParams(params, walletIdParam).walletId
  );
  return { balanceMinor };
});
