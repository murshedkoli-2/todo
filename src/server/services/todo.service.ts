import { Types } from "mongoose";
import Todo from "@/models/Todo";
import { toTodoDTO, type TodoDTO } from "@/lib/dto/todo";
import { NotFoundError } from "@/lib/api/errors";
import { derivePaymentStatus } from "@/lib/payment";
import { normalizeSubtasks, toStoredSubtasks } from "@/lib/subtasks";
import type {
  CreateTodoInput, TodoListQuery, UpdateTodoInput,
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
    status: input.status,
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
  if (input.services !== undefined || input.subtasks !== undefined) {
    const { services, subtasks } = normalizeSubtasks(
      input.services ?? input.subtasks?.map((subtask) => subtask.service) ?? [],
      input.subtasks
    );
    set.services = services;
    set.subtasks = toStoredSubtasks(subtasks);
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
  if ("paymentAmount" in input || "paidAmount" in input) {
    const current = await Todo.findOne({ _id: todoId, userId }).lean();
    if (!current) throw new NotFoundError("Task not found");
    const stored = toTodoDTO(current);

    const total =
      "paymentAmount" in input ? input.paymentAmount ?? null : stored.paymentAmountMinor;
    const paid = "paidAmount" in input ? input.paidAmount ?? null : stored.paidAmountMinor;

    set.paymentStatus = derivePaymentStatus(total, paid);
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
