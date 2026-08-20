import { z } from "zod";
import {
  currencyCode, dateInput, nonNegativeAmount, objectId, optionalText, requiredText,
} from "@/lib/schemas/common";

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

export const todoStatusSchema = z.enum(TODO_STATUSES);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const todoPrioritySchema = z.enum(TODO_PRIORITIES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export type TodoStatus = z.infer<typeof todoStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type TodoPriority = z.infer<typeof todoPrioritySchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

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
  search: z.string().trim().max(200).optional(),
});

export const todoIdParam = z.object({ id: objectId });

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type TodoListQuery = z.infer<typeof todoListQuerySchema>;
