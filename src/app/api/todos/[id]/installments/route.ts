import { handler, parseBody, parseParams } from "@/lib/api/route";
import { installmentInputSchema, todoIdParam } from "@/lib/schemas/todo";
import { addInstallment } from "@/server/services/todo.service";

export const dynamic = "force-dynamic";

type Params = { id: string };

export const POST = handler<Params>(async ({ userId, params, request }) => {
  const { id } = parseParams(params, todoIdParam);
  return addInstallment(userId, id, await parseBody(request, installmentInputSchema));
});
