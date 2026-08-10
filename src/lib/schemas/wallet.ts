import { z } from "zod";
import {
  dateInput, nonNegativeAmount, objectId, optionalText, positiveAmount, requiredText,
} from "@/lib/schemas/common";

export const ACCOUNT_TYPES = ["cash", "mobile_banking", "bank_account"] as const;
export const TX_TYPES = ["credit", "debit"] as const;

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
export const txTypeSchema = z.enum(TX_TYPES);

export type AccountType = z.infer<typeof accountTypeSchema>;
export type TxType = z.infer<typeof txTypeSchema>;

const hexColor = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Colour must be a hex value");

export const createAccountSchema = z
  .object({
    name: requiredText(100, "Account name"),
    accountType: accountTypeSchema,
    provider: optionalText(60),
    accountNumber: optionalText(30),
    initialBalance: nonNegativeAmount.default(0),
    color: hexColor.optional(),
  })
  .strict();

export const updateAccountSchema = z
  .object({
    name: requiredText(100, "Account name"),
    provider: optionalText(60).nullable(),
    accountNumber: optionalText(30).nullable(),
    color: hexColor.nullable(),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to update" });

export const createTxSchema = z
  .object({
    type: txTypeSchema,
    amount: positiveAmount,
    note: optionalText(500),
    date: dateInput.optional(),
  })
  .strict();

export const walletIdParam = z.object({ walletId: objectId });
export const txIdParam = z.object({ walletId: objectId, txId: objectId });

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateTxInput = z.infer<typeof createTxSchema>;
