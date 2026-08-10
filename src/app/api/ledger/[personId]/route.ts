import { handler, parseBody, parseParams } from "@/lib/api/route";
import { personIdParam, updatePersonSchema } from "@/lib/schemas/ledger";
import {
  deletePerson, getPersonWithEntries, updatePerson,
} from "@/server/services/ledger.service";

export const dynamic = "force-dynamic";

type Params = { personId: string };

export const GET = handler<Params>(async ({ userId, params }) =>
  getPersonWithEntries(userId, parseParams(params, personIdParam).personId)
);

export const PATCH = handler<Params>(async ({ userId, params, request }) =>
  updatePerson(
    userId,
    parseParams(params, personIdParam).personId,
    await parseBody(request, updatePersonSchema)
  )
);

export const DELETE = handler<Params>(async ({ userId, params }) => {
  await deletePerson(userId, parseParams(params, personIdParam).personId);
  return { success: true };
});
