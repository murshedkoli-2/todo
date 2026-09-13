import { handler, parseBody } from "@/lib/api/route";
import { quickEntrySchema } from "@/lib/schemas/ledger";
import { createQuickEntry } from "@/server/services/ledger.service";

export const dynamic = "force-dynamic";

/**
 * Adds one receivable or payable, naming its counterparty in the body.
 *
 * The sibling `POST /api/ledger/[personId]/entries` addresses the person in the
 * URL, which the person's own statement can do because it is already looking at
 * them. The ledger list cannot: "who" is part of what is being entered there,
 * and the person may not be in the book yet. See `createQuickEntry`.
 *
 * A static segment beats a dynamic one in Next's matcher, so this never
 * shadows a person — `[personId]` only ever matches a 24-character ObjectId
 * anyway, which "entries" is not.
 */
export const POST = handler(
  async ({ userId, request }) =>
    createQuickEntry(userId, await parseBody(request, quickEntrySchema)),
  { status: 201 }
);
