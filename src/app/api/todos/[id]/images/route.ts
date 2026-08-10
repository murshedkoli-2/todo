import { handler, parseBody, parseParams } from "@/lib/api/route";
import {
  removeTodoImageSchema, todoIdParam, todoImageActionSchema,
} from "@/lib/schemas/todo";
import { addTodoImage, removeTodoImage } from "@/server/services/todo.service";

export const dynamic = "force-dynamic";

type Params = { id: string };

export const PATCH = handler<Params>(async ({ userId, params, request }) =>
  addTodoImage(
    userId,
    parseParams(params, todoIdParam).id,
    await parseBody(request, todoImageActionSchema)
  )
);

export const DELETE = handler<Params>(async ({ userId, params, request }) => {
  const { url } = await parseBody(request, removeTodoImageSchema);
  return removeTodoImage(userId, parseParams(params, todoIdParam).id, url);
});
