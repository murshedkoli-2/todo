import { handler, parseBody, parseParams } from "@/lib/api/route";
import { createTxSchema, walletIdParam } from "@/lib/schemas/wallet";
import { createTransaction } from "@/server/services/wallet.service";

export const dynamic = "force-dynamic";

type Params = { walletId: string };

export const POST = handler<Params>(
  async ({ userId, params, request }) =>
    createTransaction(
      userId,
      parseParams(params, walletIdParam).walletId,
      await parseBody(request, createTxSchema)
    ),
  { status: 201 }
);
