import { Types } from "mongoose";
import Todo from "@/models/Todo";
import { toTodoDTO, type TodoDTO } from "@/lib/dto/todo";
import { NotFoundError } from "@/lib/api/errors";
import { derivePaymentStatus } from "@/lib/payment";
import { normalizeSubtasks, readSubtasks, toStoredSubtasks } from "@/lib/subtasks";
import { deriveStatusFromSubtasks } from "@/lib/taskStatus";
import type {
  CreateTodoInput, SubtaskPatchInput, TaskService, TodoListQuery, UpdateTodoInput,
} from "@/lib/schemas/todo";

export interface TodoPage {
  todos: TodoDTO[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/**
 * Escapes a user string for safe use inside a RegExp.
 *
 * Without this a search for `(` throws, and a search for `.*` scans every
 * document — a cheap denial of service on an unbounded collection.
 */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listTodos(
  userId: string,
  { page, limit, status, priority, service, search }: TodoListQuery
): Promise<TodoPage> {
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  // Equality against an array field matches any element, which is what the
  // multikey index on `services` is built to serve.
  if (service) filter.services = service;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ title: pattern }, { description: pattern }];
  }

  const [documents, total] = await Promise.all([
    Todo.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Todo.countDocuments(filter),
  ]);

  return {
    /* Credentials are stripped here and only here: the list is the one place
       that returns many tasks at once, and none of its surfaces render a
       password. The single-task read keeps them, because that is the screen
       the operator actually needs one on. */
    todos: documents.map((document) => toTodoDTO(document, "Me", { redactSecrets: true })),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getTodo(userId: string, todoId: string): Promise<TodoDTO> {
  const document = await Todo.findOne({ _id: todoId, userId }).lean();
  if (!document) throw new NotFoundError("Task not found");
  return toTodoDTO(document);
}

export async function createTodo(
  userId: string,
  input: CreateTodoInput
): Promise<TodoDTO> {
  /* The two service fields are produced together and never separately, so a
     sub-task for a job that was not ticked cannot be stored and a ticked job
     cannot end up without a row. */
  const { services, subtasks } = normalizeSubtasks(input.services, input.subtasks);

  const todo = await Todo.create({
    userId: new Types.ObjectId(userId),
    title: input.title,
    description: input.description,
    /* A task created with every sub-task already ticked — the wizard allows it,
       and it is how work finished before it was written down gets recorded — is
       finished on arrival. The same rule applies here as on every later write,
       so a task cannot be born in the inconsistent state updates forbid. */
    status: deriveStatusFromSubtasks(subtasks, input.status) ?? input.status,
    priority: input.priority,
    dueDate: input.dueDate ?? undefined,
    services,
    subtasks: toStoredSubtasks(subtasks),
    images: input.images,
    // A feature image the caller did not upload into `images` would render a
    // cover with no matching gallery entry, so it is folded in here.
    featureImage: input.featureImage ?? input.images[0] ?? undefined,
    paymentAmountMinor: input.paymentAmount ?? undefined,
    paidAmountMinor: input.paidAmount ?? undefined,
    paymentCurrency: input.paymentCurrency,
    paymentMethod: input.paymentMethod,
    // Derived from the amounts rather than taken from the caller: the two are
    // the same fact, and a stored status that disagrees with them is wrong.
    paymentStatus: derivePaymentStatus(input.paymentAmount, input.paidAmount),
  });

  return toTodoDTO(todo);
}

export async function updateTodo(
  userId: string,
  todoId: string,
  input: UpdateTodoInput
): Promise<TodoDTO> {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};

  const assign = (field: string, value: unknown) => {
    if (value === null || value === undefined) unset[field] = "";
    else set[field] = value;
  };

  if (input.title !== undefined) set.title = input.title;
  if (input.status !== undefined) set.status = input.status;
  if (input.priority !== undefined) set.priority = input.priority;
  if (input.paymentCurrency !== undefined) set.paymentCurrency = input.paymentCurrency;
  if (input.paymentMethod !== undefined) set.paymentMethod = input.paymentMethod;
  if (input.images !== undefined) set.images = input.images;
  /*
   * Replaces the set outright rather than merging: the picker always submits
   * the full selection, so a merge would make deselection impossible.
   *
   * `subtasks` is reconciled against `services` and both are written together.
   * A patch carrying only `subtasks` is reconciled against the services in that
   * same payload — which is what the form always sends — rather than against
   * what is stored, so this never needs an extra read.
   */
  let written: ReturnType<typeof normalizeSubtasks> | null = null;
  if (input.services !== undefined || input.subtasks !== undefined) {
    written = normalizeSubtasks(
      input.services ?? input.subtasks?.map((subtask) => subtask.service) ?? [],
      input.subtasks
    );
    set.services = written.services;
    set.subtasks = toStoredSubtasks(written.subtasks);
  }

  if ("description" in input) assign("description", input.description);
  if ("dueDate" in input) assign("dueDate", input.dueDate);
  if ("featureImage" in input) assign("featureImage", input.featureImage);
  if ("paymentAmount" in input) {
    assign("paymentAmountMinor", input.paymentAmount);
    // Clear the pre-migration float so a stale value cannot resurface through
    // the `readMinor` fallback once the new column is unset.
    unset.paymentAmount = "";
  }
  if ("paidAmount" in input) assign("paidAmountMinor", input.paidAmount);

  /*
   * Payment status follows the two amounts, so it has to be recomputed
   * whenever either moves — and a PATCH may carry only one of them. The
   * missing side is read back from the stored task through the DTO, so this
   * agrees with the figures the client was shown rather than re-deriving them
   * a second way.
   *
   * Only the payment-touching patches pay for the extra read; the far more
   * common `{ status }` from a board drag does not.
   */
  /*
   * The checklist drives the status — see `lib/taskStatus.ts`. It needs the
   * status as stored, because the interesting cases are the transitions *out*
   * of what is already there: reopening a completed task, or moving an
   * untouched one along. An explicit `status` in the same payload wins, since
   * that is the operator saying so directly.
   */
  const derivesStatus = written !== null && input.status === undefined;
  const needsStored =
    derivesStatus || "paymentAmount" in input || "paidAmount" in input;

  /* One read serves both derivations. The common patches — a board drag's
     `{ status }`, a rename — still take none. */
  if (needsStored) {
    const current = await Todo.findOne({ _id: todoId, userId }).lean();
    if (!current) throw new NotFoundError("Task not found");
    const stored = toTodoDTO(current);

    if ("paymentAmount" in input || "paidAmount" in input) {
      const total =
        "paymentAmount" in input ? input.paymentAmount ?? null : stored.paymentAmountMinor;
      const paid = "paidAmount" in input ? input.paidAmount ?? null : stored.paidAmountMinor;

      set.paymentStatus = derivePaymentStatus(total, paid);
    }

    if (derivesStatus) {
      const derived = deriveStatusFromSubtasks(written!.subtasks, stored.status);
      if (derived) set.status = derived;
    }
  }

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;

  const document = await Todo.findOneAndUpdate({ _id: todoId, userId }, update, {
    returnDocument: "after",
    runValidators: true,
  }).lean();

  if (!document) throw new NotFoundError("Task not found");
  return toTodoDTO(document);
}

/**
 * Changes one sub-task, leaving every other one exactly as stored.
 *
 * This is the write behind a checklist tick and behind editing what was
 * captured for a single job, and it exists because the whole-task PATCH is the
 * wrong tool for both. That one replaces `subtasks` outright, so a caller has
 * to send the complete array back — which means it must have loaded the
 * complete array first, credentials included, or it silently saves a redacted
 * copy over the real values. A list page has no business holding a customer's
 * password just to tick "collected" off, and now it does not have to.
 *
 * The merge happens here rather than in the client for the same reason: the
 * stored row is the only thing that knows what was there before.
 */
export async function updateSubtask(
  userId: string,
  todoId: string,
  service: TaskService,
  patch: SubtaskPatchInput
): Promise<TodoDTO> {
  const current = await Todo.findOne({ _id: todoId, userId }).lean();
  if (!current) throw new NotFoundError("Task not found");

  /* Read through the same reconciliation every other path uses, so a task
     stored before `subtasks` existed still has a row to patch. */
  const { services, subtasks } = readSubtasks(current.services, current.subtasks);

  const target = subtasks.find((subtask) => subtask.service === service);
  // The service is a valid catalogue value — the schema saw to that — but this
  // task does not cover it. Ticking a job the task does not have is a 404 on
  // the sub-task, not a silent no-op that reports success.
  if (!target) throw new NotFoundError("This task does not cover that service");

  const merged = subtasks.map((subtask) =>
    subtask.service === service
      ? {
          ...subtask,
          done: patch.done ?? subtask.done,
          /* A partial: keys the caller left out keep their stored value, and a
             key sent blank is dropped by `normalizeSubtasks` below, which is
             how a value gets cleared. */
          fields: patch.fields ? { ...subtask.fields, ...patch.fields } : subtask.fields,
        }
      : subtask
  );

  const reconciled = normalizeSubtasks(services, merged);
  const stored = toTodoDTO(current);
  const derived = deriveStatusFromSubtasks(reconciled.subtasks, stored.status);

  const set: Record<string, unknown> = {
    services: reconciled.services,
    subtasks: toStoredSubtasks(reconciled.subtasks),
  };
  if (derived) set.status = derived;

  const document = await Todo.findOneAndUpdate(
    { _id: todoId, userId },
    { $set: set },
    { returnDocument: "after", runValidators: true }
  ).lean();

  if (!document) throw new NotFoundError("Task not found");
  return toTodoDTO(document);
}

export async function deleteTodo(userId: string, todoId: string): Promise<void> {
  const result = await Todo.findOneAndDelete({ _id: todoId, userId }).lean();
  if (!result) throw new NotFoundError("Task not found");
}

export async function addTodoImage(
  userId: string,
  todoId: string,
  { addUrl, featureImage }: { addUrl?: string; featureImage?: string | null }
): Promise<TodoDTO> {
  const todo = await Todo.findOne({ _id: todoId, userId });
  if (!todo) throw new NotFoundError("Task not found");

  if (addUrl && !todo.images.includes(addUrl)) todo.images.push(addUrl);
  if (featureImage !== undefined) todo.featureImage = featureImage ?? undefined;
  // First image uploaded becomes the cover unless one was chosen explicitly.
  if (addUrl && !todo.featureImage) todo.featureImage = addUrl;

  await todo.save();
  return toTodoDTO(todo);
}

export async function removeTodoImage(
  userId: string,
  todoId: string,
  url: string
): Promise<TodoDTO> {
  const todo = await Todo.findOne({ _id: todoId, userId });
  if (!todo) throw new NotFoundError("Task not found");

  todo.images = todo.images.filter((image) => image !== url);
  // Promote the next image so a task never keeps a cover it no longer holds.
  if (todo.featureImage === url) todo.featureImage = todo.images[0] ?? undefined;

  await todo.save();
  return toTodoDTO(todo);
}

/** Status tallies for the dashboard, computed in the database. */
export async function todoStatusCounts(
  userId: string
): Promise<Record<string, number>> {
  const rows = await Todo.aggregate<{ _id: string; count: number }>([
    { $match: { userId: new Types.ObjectId(userId) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
}
