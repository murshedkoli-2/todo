import { Types } from "mongoose";
import Todo from "@/models/Todo";
import { toTodoDTO, type TodoDTO } from "@/lib/dto/todo";
import { NotFoundError } from "@/lib/api/errors";
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
  { page, limit, status, search }: TodoListQuery
): Promise<TodoPage> {
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (status) filter.status = status;
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
    todos: documents.map((document) => toTodoDTO(document)),
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
  const todo = await Todo.create({
    userId: new Types.ObjectId(userId),
    title: input.title,
    description: input.description,
    status: input.status,
    dueDate: input.dueDate ?? undefined,
    images: input.images,
    // A feature image the caller did not upload into `images` would render a
    // cover with no matching gallery entry, so it is folded in here.
    featureImage: input.featureImage ?? input.images[0] ?? undefined,
    paymentAmountMinor: input.paymentAmount ?? undefined,
    paymentCurrency: input.paymentCurrency,
    paymentStatus: input.paymentStatus,
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
  if (input.paymentCurrency !== undefined) set.paymentCurrency = input.paymentCurrency;
  if (input.paymentStatus !== undefined) set.paymentStatus = input.paymentStatus;
  if (input.images !== undefined) set.images = input.images;

  if ("description" in input) assign("description", input.description);
  if ("dueDate" in input) assign("dueDate", input.dueDate);
  if ("featureImage" in input) assign("featureImage", input.featureImage);
  if ("paymentAmount" in input) {
    assign("paymentAmountMinor", input.paymentAmount);
    // Clear the pre-migration float so a stale value cannot resurface through
    // the `readMinor` fallback once the new column is unset.
    unset.paymentAmount = "";
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
