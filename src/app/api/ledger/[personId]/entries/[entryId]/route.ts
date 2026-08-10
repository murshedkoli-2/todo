import { handler, parseParams } from "@/lib/api/route";
import { entryIdParam } from "@/lib/schemas/ledger";
import { deleteEntry } from "@/server/services/ledger.service";

export const dynamic = "force-dynamic";

type Params = { personId: string; entryId: string };

export const DELETE = handler<Params>(async ({ userId, params }) => {
  const { personId, entryId } = parseParams(params, entryIdParam);
  await deleteEntry(userId, personId, entryId);
  return { success: true };
});
