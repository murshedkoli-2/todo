import { handler, parseBody, parseParams } from "@/lib/api/route";
import { createEntrySchema, personIdParam } from "@/lib/schemas/ledger";
import { createEntry, listEntries } from "@/server/services/ledger.service";

export const dynamic = "force-dynamic";

type Params = { personId: string };

export const GET = handler<Params>(async ({ userId, params }) =>
  listEntries(userId, parseParams(params, personIdParam).personId)
);

export const POST = handler<Params>(
  async ({ userId, params, request }) =>
    createEntry(
      userId,
      parseParams(params, personIdParam).personId,
      await parseBody(request, createEntrySchema)
    ),
  { status: 201 }
);
