import { handler, parseBody, parseParams } from "@/lib/api/route";
import { todoIdParam, updateTodoSchema } from "@/lib/schemas/todo";
import { deleteTodo, getTodo, updateTodo } from "@/server/services/todo.service";

export const dynamic = "force-dynamic";

type Params = { id: string };

export const GET = handler<Params>(async ({ userId, params }) =>
  getTodo(userId, parseParams(params, todoIdParam).id)
);

export const PATCH = handler<Params>(async ({ userId, params, request }) =>
  updateTodo(
    userId,
    parseParams(params, todoIdParam).id,
    await parseBody(request, updateTodoSchema)
  )
);

export const DELETE = handler<Params>(async ({ userId, params }) => {
  await deleteTodo(userId, parseParams(params, todoIdParam).id);
  return { success: true };
});
