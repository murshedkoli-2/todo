import { handler, parseBody, parseQuery } from "@/lib/api/route";
import { createTodoSchema, todoListQuerySchema } from "@/lib/schemas/todo";
import { createTodo, listTodos } from "@/server/services/todo.service";

export const dynamic = "force-dynamic";

export const GET = handler(async ({ userId, request }) =>
  listTodos(userId, parseQuery(request, todoListQuerySchema))
);

export const POST = handler(
  async ({ userId, request }) => createTodo(userId, await parseBody(request, createTodoSchema)),
  { status: 201 }
);
