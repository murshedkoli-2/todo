import { z } from "zod";
import {
  currencyCode, dateInput, nonNegativeAmount, objectId, optionalText, requiredText,
} from "@/lib/schemas/common";
import {
  MAX_FIELD_LENGTH, SERVICE_FIELDS, TASK_SERVICES as SERVICE_CATALOGUE,
} from "@/lib/serviceCatalogue";

export const TODO_STATUSES = ["todo", "in_progress", "completed"] as const;
export const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;

/**
 * Ordered least-to-most urgent so a comparison against the array index sorts
 * correctly. `none` is the default and means "not triaged" rather than "low" —
 * conflating the two would make an untriaged backlog look deliberately
 * deprioritised.
 */
export const TODO_PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;

/**
 * How the money arrived. Mirrors the vocabulary the wallet already uses, so a
 * task's method and an account's type read the same way across the app.
 * `unset` is the default — most tasks are recorded before anyone has paid.
 */
export const PAYMENT_METHODS = [
  "unset", "cash", "bkash", "nagad", "rocket", "bank", "other",
] as const;

/**
 * The desk's standing catalogue of jobs, re-exported from
 * `lib/serviceCatalogue.ts`.
 *
 * The enum lives there because the per-service field table is keyed by it and
 * this file has to read that table to validate a sub-task — defining the enum
 * here as well would make the two modules import each other. Every existing
 * `from "@/lib/schemas/todo"` import keeps working.
 */
export { TASK_SERVICES } from "@/lib/serviceCatalogue";
export type { TaskService } from "@/lib/serviceCatalogue";

export const todoStatusSchema = z.enum(TODO_STATUSES);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const todoPrioritySchema = z.enum(TODO_PRIORITIES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const taskServiceSchema = z.enum(SERVICE_CATALOGUE);

export type TodoStatus = z.infer<typeof todoStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type TodoPriority = z.infer<typeof todoPrioritySchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/**
 * A set of services, not a list. Duplicates are dropped rather than rejected —
 * a double-tap on a chip is a slip, not an error worth a red banner — and the
 * result is sorted into catalogue order so two tasks holding the same work
 * render the same chips in the same places.
 *
 * The pre-transform cap keeps a hostile payload from allocating before the
 * dedupe runs; after it, the length can never exceed the catalogue.
 */
export const taskServiceList = z
  .array(taskServiceSchema)
  .max(50, "Too many services")
  .transform((services) =>
    Array.from(new Set(services)).sort(
      (a, b) => SERVICE_CATALOGUE.indexOf(a) - SERVICE_CATALOGUE.indexOf(b)
    )
  );


/** The most fields any single service asks for, used to bound a payload. */
const MAX_FIELDS_PER_SUBTASK = Math.max(
  ...SERVICE_CATALOGUE.map((service) => SERVICE_FIELDS[service].length)
);

/**
 * One ticked service, plus what was captured for it.
 *
 * `fields` is validated as a loose string map here and reconciled against the
 * catalogue by `normalizeSubtasks` rather than being described key-by-key in
 * zod. Two reasons: the accepted keys depend on the sibling `service` value,
 * which a plain object schema cannot express without a discriminated union of
 * nine branches; and the reconciliation has to run on the *stored* side too,
 * for documents written before a field existed. One implementation of that rule
 * is worth more than a schema that duplicates it and drifts.
 *
 * What zod does own is the shape and the size — a caller cannot send a nested
 * object, a 4 MB string, or ten thousand keys and reach the normalizer at all.
 */
const subtaskFieldMap = z
  .record(z.string().max(MAX_FIELD_LENGTH, `A value cannot exceed ${MAX_FIELD_LENGTH} characters`))
  .refine(
    (fields) => Object.keys(fields).length <= MAX_FIELDS_PER_SUBTASK,
    `A sub-task holds at most ${MAX_FIELDS_PER_SUBTASK} fields`
  );

export const subtaskSchema = z
  .object({
    service: taskServiceSchema,
    done: z.boolean().default(false),
    fields: subtaskFieldMap.default({}),
  })
  .strict();

/**
 * Capped at the catalogue length: one row per service is the most that can
 * survive normalization, so anything longer is either a duplicate or noise and
 * there is no reason to parse it.
 */
export const subtaskList = z
  .array(subtaskSchema)
  .max(SERVICE_CATALOGUE.length, "Too many sub-tasks");

/**
 * Image URLs are constrained to the hosts declared in `next.config.mjs`
 * `images.remotePatterns`. Without this an arbitrary attacker-supplied string
 * lands in the document and is handed straight to `next/image`.
 */
const ALLOWED_IMAGE_HOSTS = [/^([a-z0-9-]+\.)*ibb\.co$/i];

export const imageUrl = z
  .string()
  .trim()
  .max(2048)
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid image URL" });
      return;
    }
    if (parsed.protocol !== "https:") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Image URL must use HTTPS" });
      return;
    }
    if (!ALLOWED_IMAGE_HOSTS.some((pattern) => pattern.test(parsed.hostname))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Image host is not allowed" });
    }
  });

/** Caps the array so a single request cannot balloon a document. */
export const imageUrlList = z.array(imageUrl).max(20, "A task can hold at most 20 images");

export const createTodoSchema = z.object({
  title: requiredText(200, "Title"),
  description: optionalText(2000),
  status: todoStatusSchema.default("todo"),
  priority: todoPrioritySchema.default("none"),
  dueDate: dateInput.nullish(),
  /* Which catalogue jobs this task covers. Empty is valid — a task can be
     ordinary work that is not one of the standing services. */
  services: taskServiceList.default([]),
  /* The information captured against each ticked service. Reconciled against
     `services` by the service layer, so a row here for a job that is not ticked
     is dropped rather than rejected. */
  subtasks: subtaskList.default([]),
  images: imageUrlList.default([]),
  featureImage: imageUrl.nullish(),
  /* The job's total cost. Named `paymentAmount` because that is what the field
     has always held — every existing row's amount is a price, not a receipt. */
  paymentAmount: nonNegativeAmount.nullish(),
  /* What has been received against that total. */
  paidAmount: nonNegativeAmount.nullish(),
  paymentCurrency: currencyCode.default("BDT"),
  paymentMethod: paymentMethodSchema.default("unset"),
  /* Derived from the two amounts by the service; accepted here only so an
     existing API caller that still sends it is not rejected. */
  paymentStatus: paymentStatusSchema.default("unpaid"),
});

/**
 * Every field optional, but `.strict()` so an unknown key is rejected rather
 * than silently ignored — that is what let `images` through unvalidated before.
 */
export const updateTodoSchema = z
  .object({
    title: requiredText(200, "Title"),
    description: optionalText(2000).nullable(),
    status: todoStatusSchema,
    priority: todoPrioritySchema,
    dueDate: dateInput.nullable(),
    services: taskServiceList,
    subtasks: subtaskList,
    images: imageUrlList,
    featureImage: imageUrl.nullable(),
    paymentAmount: nonNegativeAmount.nullable(),
    paidAmount: nonNegativeAmount.nullable(),
    paymentCurrency: currencyCode,
    paymentMethod: paymentMethodSchema,
    paymentStatus: paymentStatusSchema,
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to update" });

export const todoImageActionSchema = z
  .object({
    featureImage: imageUrl.nullable().optional(),
    addUrl: imageUrl.optional(),
  })
  .strict()
  .refine((body) => body.featureImage !== undefined || body.addUrl !== undefined, {
    message: "Provide featureImage or addUrl",
  });

export const removeTodoImageSchema = z.object({ url: imageUrl }).strict();

export const todoListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: todoStatusSchema.optional(),
  priority: todoPrioritySchema.optional(),
  /* Narrows the list to tasks holding this job — "show me every open
     passport correction" is the question the catalogue exists to answer. */
  service: taskServiceSchema.optional(),
  search: z.string().trim().max(200).optional(),
});

export const todoIdParam = z.object({ id: objectId });

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type TodoListQuery = z.infer<typeof todoListQuerySchema>;
export type SubtaskInput = z.infer<typeof subtaskSchema>;
