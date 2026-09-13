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

/**
 * An entry that names its own counterparty — the ledger page's quick add.
 *
 * `createEntrySchema` addresses the person in the URL, which is right for the
 * person's own statement and wrong for adding from the list: there, "who" is
 * part of what is being entered, and the counterparty may not exist yet. Making
 * the caller create the person first would mean two requests with a gap between
 * them, and a failure in that gap leaves an empty person in the book.
 *
 * Exactly one of `personId` and `personName`. Accepting both would leave the
 * server picking a winner, and the two disagreeing is precisely the case where
 * the money would land on the wrong person.
 */
export const quickEntrySchema = createEntrySchema
  .extend({
    /** An existing counterparty, picked from the list. */
    personId: objectId.optional(),
    /** A name typed instead; matched against the book, then created if new. */
    personName: requiredText(100, "Name").optional(),
  })
  .refine(
    (body) => (body.personId === undefined) !== (body.personName === undefined),
    { message: "Pick a person or type a name — not both." }
  );

export const personIdParam = z.object({ personId: objectId });
export const entryIdParam = z.object({ personId: objectId, entryId: objectId });

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type QuickEntryInput = z.infer<typeof quickEntrySchema>;
