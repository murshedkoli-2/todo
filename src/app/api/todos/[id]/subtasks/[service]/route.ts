import { handler, parseBody, parseParams } from "@/lib/api/route";
import { subtaskParams, subtaskPatchSchema } from "@/lib/schemas/todo";
import { updateSubtask } from "@/server/services/todo.service";

export const dynamic = "force-dynamic";

type Params = { id: string; service: string };

/**
 * Updates one sub-task of one task — a tick, a captured value, or both.
 *
 * Addressing the row in the URL rather than sending the whole array back is
 * what lets a surface that never loaded a task's credentials still tick its
 * checklist; see `updateSubtask` for the full reasoning.
 *
 * Returns the whole task, because the write can move the task's own status:
 * ticking the last sub-task completes it. A caller that got back only the row
 * it changed would render a completed task as still open until the next load.
 */
export const PATCH = handler<Params>(async ({ userId, params, request }) => {
  const { id, service } = parseParams(params, subtaskParams);
  return updateSubtask(userId, id, service, await parseBody(request, subtaskPatchSchema));
});
