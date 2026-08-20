import type { Types } from "mongoose";
import { readMinor } from "@/lib/money";
import { dueMinor, legacyPaidMinor } from "@/lib/payment";
import type {
  PaymentMethod, PaymentStatus, TodoPriority, TodoStatus,
} from "@/lib/schemas/todo";

/** The shape the client receives. Amounts are integer minor units. */
export interface TodoDTO {
  _id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  ownerName: string;
  images: string[];
  featureImage: string | null;
  /** The job's total cost. */
  paymentAmountMinor: number | null;
  /** Received so far. `null` means "not recorded", which is not the same as 0. */
  paidAmountMinor: number | null;
  /** Still owed. Derived, never stored — see `lib/payment.ts`. */
  dueAmountMinor: number | null;
  paymentCurrency: string;
  paymentMethod: PaymentMethod;
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
  priority?: string | null;
  dueDate?: Date | null;
  images?: string[] | null;
  featureImage?: string | null;
  paymentAmountMinor?: number | null;
  paidAmountMinor?: number | null;
  paymentAmount?: number | null;
  paymentCurrency?: string | null;
  paymentMethod?: string | null;
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

  const status = (source.paymentStatus ?? "unpaid") as PaymentStatus;
  const totalMinor = hasPayment
    ? readMinor(source.paymentAmountMinor, source.paymentAmount, currency)
    : null;

  /*
   * Rows written before the paid column existed have to have their figure
   * inferred from the total and the status the user set by hand, or reopening
   * an old task would show it as unpaid regardless of what it said yesterday.
   */
  const paidMinor =
    source.paidAmountMinor != null
      ? source.paidAmountMinor
      : legacyPaidMinor(totalMinor, status);

  return {
    _id: source._id.toString(),
    title: source.title,
    description: source.description ?? undefined,
    status: (source.status ?? "todo") as TodoStatus,
    // Documents written before priority existed have no field at all.
    priority: (source.priority ?? "none") as TodoPriority,
    dueDate: source.dueDate ? source.dueDate.toISOString() : null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
    userId: source.userId.toString(),
    ownerName,
    images: source.images ?? [],
    featureImage: source.featureImage ?? null,
    paymentAmountMinor: totalMinor,
    paidAmountMinor: paidMinor,
    dueAmountMinor: dueMinor(totalMinor, paidMinor),
    paymentCurrency: currency,
    paymentMethod: (source.paymentMethod ?? "unset") as PaymentMethod,
    paymentStatus: status,
  };
}
