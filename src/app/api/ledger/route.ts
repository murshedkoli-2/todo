import { handler, parseBody } from "@/lib/api/route";
import { createPersonSchema } from "@/lib/schemas/ledger";
import { createPerson, listPersons } from "@/server/services/ledger.service";

export const dynamic = "force-dynamic";

export const GET = handler(async ({ userId }) => listPersons(userId));

export const POST = handler(
  async ({ userId, request }) =>
    createPerson(userId, await parseBody(request, createPersonSchema)),
  { status: 201 }
);
