import { z } from "zod";
import {
  dateInput, objectId, optionalText, positiveAmount, requiredText,
} from "@/lib/schemas/common";

export const ENTRY_TYPES = ["receivable", "payable"] as const;
export const entryTypeSchema = z.enum(ENTRY_TYPES);
export type EntryType = z.infer<typeof entryTypeSchema>;

export const createPersonSchema = z
  .object({
    name: requiredText(100, "Name"),
    note: optionalText(500),
    initialAmount: positiveAmount.nullish(),
    initialType: entryTypeSchema.default("receivable"),
  })
  .strict();

export const updatePersonSchema = z
  .object({
    name: requiredText(100, "Name"),
    note: optionalText(500).nullable(),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to update" });

export const createEntrySchema = z
  .object({
    type: entryTypeSchema,
    amount: positiveAmount,
    note: optionalText(500),
    date: dateInput.optional(),
  })
  .strict();

export const personIdParam = z.object({ personId: objectId });
export const entryIdParam = z.object({ personId: objectId, entryId: objectId });

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type CreateEntryInput = z.infer<typeof createEntrySchema>;
