import type { Types } from "mongoose";
import { readMinor } from "@/lib/money";
import type { PaymentStatus, TodoStatus } from "@/lib/schemas/todo";

/** The shape the client receives. Amounts are integer minor units. */
export interface TodoDTO {
  _id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  ownerName: string;
  images: string[];
  featureImage: string | null;
  paymentAmountMinor: number | null;
  paymentCurrency: string;
  paymentStatus: PaymentStatus;
}

/**
 * Anything with the fields we read — accepts both a hydrated document and the
 * plain object from `.lean()`, so callers can pick whichever is cheaper.
 */
export interface TodoSource {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  title: string;
  description?: string | null;
  status: string;
  dueDate?: Date | null;
  images?: string[] | null;
  featureImage?: string | null;
  paymentAmountMinor?: number | null;
  paymentAmount?: number | null;
  paymentCurrency?: string | null;
  paymentStatus?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The single place a Todo becomes JSON. Replaces the eight hand-written copies
 * of this mapping that had already drifted apart across routes and pages.
 */
export function toTodoDTO(source: TodoSource, ownerName = "Me"): TodoDTO {
  const currency = source.paymentCurrency ?? "BDT";
  const hasPayment =
    source.paymentAmountMinor != null || source.paymentAmount != null;

  return {
    _id: source._id.toString(),
    title: source.title,
    description: source.description ?? undefined,
    status: (source.status ?? "todo") as TodoStatus,
    dueDate: source.dueDate ? source.dueDate.toISOString() : null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
    userId: source.userId.toString(),
    ownerName,
    images: source.images ?? [],
    featureImage: source.featureImage ?? null,
    paymentAmountMinor: hasPayment
      ? readMinor(source.paymentAmountMinor, source.paymentAmount, currency)
      : null,
    paymentCurrency: currency,
    paymentStatus: (source.paymentStatus ?? "unpaid") as PaymentStatus,
  };
}
