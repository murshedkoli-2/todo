import { handler, parseBody, parseParams } from "@/lib/api/route";
import { todoIdParam, updatePaymentSchema } from "@/lib/schemas/todo";
import { updatePayment } from "@/server/services/todo.service";

export const dynamic = "force-dynamic";

type Params = { id: string };

export const PATCH = handler<Params>(async ({ userId, params, request }) => {
  const { id } = parseParams(params, todoIdParam);
  return updatePayment(userId, id, await parseBody(request, updatePaymentSchema));
});
