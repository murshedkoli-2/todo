import { handler, parseParams } from "@/lib/api/route";
import { installmentParams } from "@/lib/schemas/todo";
import { deleteInstallment } from "@/server/services/todo.service";

export const dynamic = "force-dynamic";

type Params = { id: string; installmentId: string };

export const DELETE = handler<Params>(async ({ userId, params }) => {
  const { id, installmentId } = parseParams(params, installmentParams);
  return deleteInstallment(userId, id, installmentId);
});
