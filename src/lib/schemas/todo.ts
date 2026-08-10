import { z } from "zod";
import {
  currencyCode, dateInput, nonNegativeAmount, objectId, optionalText, requiredText,
} from "@/lib/schemas/common";

export const TODO_STATUSES = ["todo", "in_progress", "completed"] as const;
export const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;

export const todoStatusSchema = z.enum(TODO_STATUSES);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);

export type TodoStatus = z.infer<typeof todoStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

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
  dueDate: dateInput.nullish(),
  images: imageUrlList.default([]),
  featureImage: imageUrl.nullish(),
  paymentAmount: nonNegativeAmount.nullish(),
  paymentCurrency: currencyCode.default("BDT"),
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
    dueDate: dateInput.nullable(),
    images: imageUrlList,
    featureImage: imageUrl.nullable(),
    paymentAmount: nonNegativeAmount.nullable(),
    paymentCurrency: currencyCode,
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
  search: z.string().trim().max(200).optional(),
});

export const todoIdParam = z.object({ id: objectId });

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type TodoListQuery = z.infer<typeof todoListQuerySchema>;
