"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/apiClient";
import { useToast } from "@/components/ui/ToastProvider";
import Money from "@/components/ui/Money";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ProgressBar from "@/components/ui/ProgressBar";
import {
  AlertIcon, CheckIcon, EditIcon, PlusIcon, SpinnerIcon, TrashIcon, WalletIcon,
} from "@/components/ui/icons";
import { fromMinor, toMinor } from "@/lib/money";
import type {
  PaymentMethod, TaskInstallment, Todo,
} from "@/lib/types";
import {
  PAYMENT_METHOD_CHOICES, PAYMENT_METHOD_COLORS, PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TEXT_COLORS,
} from "@/lib/types";

const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "INR"];

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

interface PaymentManagerProps {
  todo: Todo;
  onUpdate: (updated: Todo) => void;
  busy?: boolean;
}

export default function PaymentManager({ todo, onUpdate, busy = false }: PaymentManagerProps) {
  const toast = useToast();

  const [showAddInstallment, setShowAddInstallment] = useState(false);
  const [showUpdatePayment, setShowUpdatePayment] = useState(false);
  const [installmentToDelete, setInstallmentToDelete] = useState<TaskInstallment | null>(null);

  // Add installment state
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [installmentDate, setInstallmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [installmentMethod, setInstallmentMethod] = useState<PaymentMethod>("cash");
  const [installmentNote, setInstallmentNote] = useState("");
  const [addingInstallment, setAddingInstallment] = useState(false);
  const [addError, setAddError] = useState("");

  // Update payment state
  const [paymentAmount, setPaymentAmount] = useState(
    todo.paymentAmountMinor != null
      ? String(fromMinor(todo.paymentAmountMinor, todo.paymentCurrency))
      : ""
  );
  const [initialPayment, setInitialPayment] = useState(
    todo.initialPaymentMinor != null
      ? String(fromMinor(todo.initialPaymentMinor, todo.paymentCurrency))
      : ""
  );
  const [paymentCurrency, setPaymentCurrency] = useState(todo.paymentCurrency || "BDT");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(todo.paymentMethod || "unset");
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [updateError, setUpdateError] = useState("");

  // Delete state
  const [deletingInstallment, setDeletingInstallment] = useState(false);

  // Calculated metrics
  const totalCostMinor = todo.paymentAmountMinor;
  const initialMinor = todo.initialPaymentMinor ?? 0;
  const installments = todo.installments || [];
  const installmentsSumMinor = installments.reduce((sum, inst) => sum + inst.amountMinor, 0);
  const totalPaidMinor = (initialMinor > 0 || installments.length > 0)
    ? (initialMinor + installmentsSumMinor)
    : (todo.paidAmountMinor ?? 0);
  const dueAmountMinor = totalCostMinor != null
    ? Math.max(0, totalCostMinor - totalPaidMinor)
    : null;

  const pctPaid = totalCostMinor && totalCostMinor > 0
    ? Math.min(100, Math.round((totalPaidMinor / totalCostMinor) * 100))
    : totalPaidMinor > 0
      ? 100
      : 0;

  /* ── Open Modals ──────────────────────────────────────────────────────── */
  const openAddInstallmentModal = () => {
    setInstallmentAmount("");
    setInstallmentDate(new Date().toISOString().slice(0, 10));
    setInstallmentMethod(todo.paymentMethod !== "unset" ? todo.paymentMethod : "cash");
    setInstallmentNote("");
    setAddError("");
    setShowAddInstallment(true);
  };

  const openUpdatePaymentModal = () => {
    setPaymentAmount(
      todo.paymentAmountMinor != null
        ? String(fromMinor(todo.paymentAmountMinor, todo.paymentCurrency))
        : ""
    );
    setInitialPayment(
      todo.initialPaymentMinor != null
        ? String(fromMinor(todo.initialPaymentMinor, todo.paymentCurrency))
        : ""
    );
    setPaymentCurrency(todo.paymentCurrency || "BDT");
    setPaymentMethod(todo.paymentMethod || "unset");
    setUpdateError("");
    setShowUpdatePayment(true);
  };

  /* ── Submit Add Installment ───────────────────────────────────────────── */
  const handleAddInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!installmentAmount.trim()) {
      setAddError("Please enter an installment amount.");
      return;
    }
    const minor = toMinor(installmentAmount, todo.paymentCurrency);
    if (minor === null || minor <= 0) {
      setAddError("Amount must be a positive number.");
      return;
    }

    setAddingInstallment(true);
    setAddError("");
    try {
      const updated = await api<Todo>(`/api/todos/${todo._id}/installments`, {
        method: "POST",
        body: {
          amount: Number(installmentAmount),
          date: installmentDate ? new Date(installmentDate).toISOString() : new Date().toISOString(),
          paymentMethod: installmentMethod,
          note: installmentNote.trim() || undefined,
        },
      });
      onUpdate(updated);
      toast.success("Installment added successfully.");
      setShowAddInstallment(false);
    } catch (caught) {
      setAddError(errorMessage(caught));
    } finally {
      setAddingInstallment(false);
    }
  };

  /* ── Submit Update Payment ────────────────────────────────────────────── */
  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTotal = paymentAmount.trim() ? Number(paymentAmount) : null;
    const parsedInitial = initialPayment.trim() ? Number(initialPayment) : null;

    if (parsedTotal !== null && (isNaN(parsedTotal) || parsedTotal < 0)) {
      setUpdateError("Total cost must be a non-negative number.");
      return;
    }
    if (parsedInitial !== null && (isNaN(parsedInitial) || parsedInitial < 0)) {
      setUpdateError("Initial payment must be a non-negative number.");
      return;
    }

    setUpdatingPayment(true);
    setUpdateError("");
    try {
      const updated = await api<Todo>(`/api/todos/${todo._id}/payment`, {
        method: "PATCH",
        body: {
          paymentAmount: parsedTotal,
          initialPayment: parsedInitial,
          paymentCurrency,
          paymentMethod,
        },
      });
      onUpdate(updated);
      toast.success("Payment details updated.");
      setShowUpdatePayment(false);
    } catch (caught) {
      setUpdateError(errorMessage(caught));
    } finally {
      setUpdatingPayment(false);
    }
  };

  /* ── Confirm Delete Installment ───────────────────────────────────────── */
  const handleDeleteInstallment = async () => {
    if (!installmentToDelete?._id) return;
    setDeletingInstallment(true);
    try {
      const updated = await api<Todo>(
        `/api/todos/${todo._id}/installments/${installmentToDelete._id}`,
        { method: "DELETE" }
      );
      onUpdate(updated);
      toast.success("Installment removed.");
      setInstallmentToDelete(null);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDeletingInstallment(false);
    }
  };

  // Preview calculations for Add Installment Modal
  const inputInstallmentMinor = toMinor(installmentAmount, todo.paymentCurrency) ?? 0;
  const projectedDueMinor = dueAmountMinor != null
    ? Math.max(0, dueAmountMinor - inputInstallmentMinor)
    : null;

  return (
    <section className="panel">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-well flex items-center justify-center flex-shrink-0"
            style={{
              background: `color-mix(in srgb, ${PAYMENT_STATUS_COLORS[todo.paymentStatus]} 14%, transparent)`,
              color: PAYMENT_STATUS_COLORS[todo.paymentStatus],
            }}
          >
            <WalletIcon className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-section text-ink flex items-center gap-2">
              Payment & Installments
              <span
                className="pill text-[11px] font-semibold"
                style={{
                  background: `color-mix(in srgb, ${PAYMENT_STATUS_COLORS[todo.paymentStatus]} 14%, transparent)`,
                  color: PAYMENT_STATUS_TEXT_COLORS[todo.paymentStatus],
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: PAYMENT_STATUS_COLORS[todo.paymentStatus] }}
                />
                {PAYMENT_STATUS_LABELS[todo.paymentStatus]}
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openUpdatePaymentModal}
            disabled={busy}
            className="btn-ghost text-xs px-3 py-1.5 h-8 font-semibold flex items-center gap-1.5"
          >
            <EditIcon className="w-3.5 h-3.5" />
            Update Payment
          </button>
          <button
            type="button"
            onClick={openAddInstallmentModal}
            disabled={busy}
            className="btn-primary text-xs px-3 py-1.5 h-8 font-semibold flex items-center gap-1.5"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Add Installment
          </button>
        </div>
      </div>

      {/* ── Summary Stats Grid ── */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-well mb-4"
        style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)" }}
      >
        <div>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            Total Cost
          </span>
          <div className="mt-1">
            {totalCostMinor != null ? (
              <Money
                minor={totalCostMinor}
                currency={todo.paymentCurrency}
                size="md"
                tone="neutral"
              />
            ) : (
              <span className="text-sm font-semibold text-ink-secondary">Not set</span>
            )}
          </div>
        </div>

        <div>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            Initial Advance
          </span>
          <div className="mt-1">
            {initialMinor > 0 ? (
              <Money
                minor={initialMinor}
                currency={todo.paymentCurrency}
                size="md"
                tone="neutral"
              />
            ) : (
              <span className="text-sm font-semibold text-ink-secondary">None</span>
            )}
          </div>
        </div>

        <div>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            Total Paid
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <Money
              minor={totalPaidMinor}
              currency={todo.paymentCurrency}
              size="md"
              tone={totalPaidMinor > 0 ? "positive" : "neutral"}
            />
            {installments.length > 0 && (
              <span className="text-[11px] text-ink-muted">
                ({installments.length} {installments.length === 1 ? "installment" : "installments"})
              </span>
            )}
          </div>
        </div>

        <div>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            Still Due
          </span>
          <div className="mt-1">
            {dueAmountMinor != null ? (
              <Money
                minor={dueAmountMinor}
                currency={todo.paymentCurrency}
                size="lg"
                tone={dueAmountMinor > 0 ? "negative" : "positive"}
              />
            ) : (
              <span className="text-sm font-semibold text-ink-secondary">—</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      {totalCostMinor != null && totalCostMinor > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-ink-secondary font-medium">Payment Progress</span>
            <span className="text-ink font-semibold">{pctPaid}% completed</span>
          </div>
          <ProgressBar
            value={pctPaid}
            color={pctPaid >= 100 ? "var(--green)" : "var(--accent)"}
            className="h-2 rounded-full"
          />
        </div>
      )}

      {/* ── Payment Schedule / History Breakdown ── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Payment Breakdown & History
          </h3>
          <span className="text-xs text-ink-muted">
            {(initialMinor > 0 ? 1 : 0) + installments.length} recorded entry
            {((initialMinor > 0 ? 1 : 0) + installments.length) === 1 ? "" : "s"}
          </span>
        </div>

        {initialMinor <= 0 && installments.length === 0 && totalCostMinor == null ? (
          <div
            className="p-6 text-center rounded-well border border-dashed border-line"
            style={{ background: "var(--bg-sunken)" }}
          >
            <p className="text-sm text-ink-secondary mb-3">
              No payments or total cost recorded for this task yet.
            </p>
            <button
              type="button"
              onClick={openUpdatePaymentModal}
              className="btn-secondary text-xs px-4 py-2 font-semibold"
            >
              Set Total Cost & Initial Payment
            </button>
          </div>
        ) : (
          <div
            className="divide-y divide-line rounded-well border border-line overflow-hidden"
            style={{ background: "var(--bg-card)" }}
          >
            {/* Initial Payment Row (if recorded) */}
            {initialMinor > 0 && (
              <div className="flex items-center justify-between p-3.5 hover:bg-hover transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    1
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">Initial Payment (Advance)</span>
                      {todo.paymentMethod !== "unset" && (
                        <span
                          className="pill text-[10px] py-0.5 px-2 font-medium"
                          style={{
                            background: `color-mix(in srgb, ${PAYMENT_METHOD_COLORS[todo.paymentMethod]} 14%, transparent)`,
                            color: "var(--text-primary)",
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full mr-1 inline-block"
                            style={{ background: PAYMENT_METHOD_COLORS[todo.paymentMethod] }}
                          />
                          {PAYMENT_METHOD_LABELS[todo.paymentMethod]}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-ink-muted">Recorded at task creation</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <Money
                    minor={initialMinor}
                    currency={todo.paymentCurrency}
                    size="sm"
                    tone="neutral"
                  />
                </div>
              </div>
            )}

            {/* Installments Rows */}
            {installments.map((inst, index) => {
              const installmentNumber = (initialMinor > 0 ? 2 : 1) + index;
              const color = PAYMENT_METHOD_COLORS[inst.paymentMethod] || "var(--text-secondary)";

              return (
                <div
                  key={inst._id || `inst-${index}`}
                  className="flex items-center justify-between p-3.5 hover:bg-hover transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)" }}
                    >
                      {installmentNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">
                          Installment #{index + 1}
                        </span>
                        <span
                          className="pill text-[10px] py-0.5 px-2 font-medium"
                          style={{
                            background: `color-mix(in srgb, ${color} 14%, transparent)`,
                            color: "var(--text-primary)",
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full mr-1 inline-block"
                            style={{ background: color }}
                          />
                          {PAYMENT_METHOD_LABELS[inst.paymentMethod]}
                        </span>
                        <span className="text-xs text-ink-muted">· {formatDate(inst.date)}</span>
                      </div>
                      {inst.note && (
                        <p className="text-xs text-ink-secondary mt-0.5 truncate">{inst.note}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Money
                      minor={inst.amountMinor}
                      currency={todo.paymentCurrency}
                      size="sm"
                      tone="positive"
                    />
                    <button
                      type="button"
                      onClick={() => setInstallmentToDelete(inst)}
                      disabled={busy}
                      className="btn-ghost w-7 h-7 px-0 opacity-40 group-hover:opacity-100 hover:text-red transition-all"
                      aria-label={`Delete installment ${index + 1}`}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Installment Modal ── */}
      {showAddInstallment && (
        <Modal
          title="Record Installment"
          subtitle={`Task: ${todo.title}`}
          icon={<PlusIcon className="w-5 h-5" />}
          iconColor="var(--accent)"
          onClose={() => setShowAddInstallment(false)}
        >
          <form onSubmit={handleAddInstallment} className="flex flex-col gap-4">
            {addError && (
              <p className="alert-error" role="alert">
                <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {addError}
              </p>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="inst-amount" className="field-label mb-0">
                  Installment Amount
                </label>
                {dueAmountMinor != null && dueAmountMinor > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setInstallmentAmount(String(fromMinor(dueAmountMinor, todo.paymentCurrency)))
                    }
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Pay full remaining (
                    <Money minor={dueAmountMinor} currency={todo.paymentCurrency} compact />)
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="inst-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  className="input-dark w-full text-base font-semibold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="inst-date" className="field-label">
                Payment Date
              </label>
              <input
                id="inst-date"
                type="date"
                required
                value={installmentDate}
                onChange={(e) => setInstallmentDate(e.target.value)}
                className="input-dark w-full cursor-pointer"
              />
            </div>

            <div>
              <span className="field-label">Payment Method</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Payment method">
                {PAYMENT_METHOD_CHOICES.filter((m) => m !== "unset").map((option) => {
                  const active = installmentMethod === option;
                  const color = PAYMENT_METHOD_COLORS[option];
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setInstallmentMethod(option)}
                      className="flex items-center gap-1.5 px-3 h-8 rounded-control text-xs font-semibold transition-all"
                      style={{
                        background: active
                          ? `color-mix(in srgb, ${color} 14%, transparent)`
                          : "var(--bg-sunken)",
                        border: `1px solid ${active ? color : "transparent"}`,
                        color: active ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      {PAYMENT_METHOD_LABELS[option]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="inst-note" className="field-label">
                Note / Reference <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <input
                id="inst-note"
                type="text"
                maxLength={200}
                placeholder="e.g. 2nd installment, TrxID 9K28..."
                value={installmentNote}
                onChange={(e) => setInstallmentNote(e.target.value)}
                className="input-dark w-full"
              />
            </div>

            {/* Balance Preview */}
            {dueAmountMinor != null && inputInstallmentMinor > 0 && (
              <div
                className="p-3 rounded-well text-xs flex items-center justify-between"
                style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)" }}
              >
                <span className="text-ink-secondary">Remaining due after this payment:</span>
                <Money
                  minor={projectedDueMinor ?? 0}
                  currency={todo.paymentCurrency}
                  size="sm"
                  tone={projectedDueMinor && projectedDueMinor > 0 ? "negative" : "positive"}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setShowAddInstallment(false)}
                disabled={addingInstallment}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingInstallment}
                className="btn-primary flex items-center gap-2"
              >
                {addingInstallment ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Record Installment
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Update Payment Details Modal ── */}
      {showUpdatePayment && (
        <Modal
          title="Update Payment Details"
          subtitle={`Task: ${todo.title}`}
          icon={<EditIcon className="w-5 h-5" />}
          iconColor="var(--accent)"
          onClose={() => setShowUpdatePayment(false)}
        >
          <form onSubmit={handleUpdatePayment} className="flex flex-col gap-4">
            {updateError && (
              <p className="alert-error" role="alert">
                <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {updateError}
              </p>
            )}

            <div>
              <label htmlFor="update-payment-amount" className="field-label">
                Total Cost <span className="font-normal text-ink-muted">(Agreed Price)</span>
              </label>
              <div className="flex gap-2">
                <select
                  id="update-payment-currency"
                  aria-label="Currency"
                  value={paymentCurrency}
                  onChange={(e) => setPaymentCurrency(e.target.value)}
                  className="input-dark flex-shrink-0 w-24 cursor-pointer"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  id="update-payment-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="input-dark flex-1 font-semibold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="update-initial-payment" className="field-label">
                Initial Payment / Advance{" "}
                <span className="font-normal text-ink-muted">(Paid at start)</span>
              </label>
              <input
                id="update-initial-payment"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={initialPayment}
                onChange={(e) => setInitialPayment(e.target.value)}
                className="input-dark w-full"
              />
            </div>

            <div>
              <span className="field-label">Payment Method</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Payment method">
                {PAYMENT_METHOD_CHOICES.map((option) => {
                  const active = paymentMethod === option;
                  const color = PAYMENT_METHOD_COLORS[option];
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPaymentMethod(option)}
                      className="flex items-center gap-1.5 px-3 h-8 rounded-control text-xs font-semibold transition-all"
                      style={{
                        background: active
                          ? `color-mix(in srgb, ${color} 14%, transparent)`
                          : "var(--bg-sunken)",
                        border: `1px solid ${active ? color : "transparent"}`,
                        color: active ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      {PAYMENT_METHOD_LABELS[option]}
                    </button>
                  );
                })}
              </div>
            </div>

            {installments.length > 0 && (
              <div
                className="p-3 rounded-well text-xs"
                style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)" }}
              >
                <span className="text-ink-secondary">
                  Note: This task has {installments.length} installment
                  {installments.length === 1 ? "" : "s"} totaling{" "}
                  <strong>
                    <Money minor={installmentsSumMinor} currency={paymentCurrency} compact />
                  </strong>
                  . The total paid will be initial payment + installments.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setShowUpdatePayment(false)}
                disabled={updatingPayment}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingPayment}
                className="btn-primary flex items-center gap-2"
              >
                {updatingPayment ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Save Payment Details
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Confirm Delete Installment Dialog ── */}
      {installmentToDelete && (
        <ConfirmDialog
          title="Delete Installment?"
          message={`Are you sure you want to remove this installment of ${
            installmentToDelete.amountMinor
              ? fromMinor(installmentToDelete.amountMinor, todo.paymentCurrency)
              : 0
          } ${todo.paymentCurrency}? This will adjust the task balance and payment status.`}
          busy={deletingInstallment}
          onConfirm={handleDeleteInstallment}
          onCancel={() => setInstallmentToDelete(null)}
        />
      )}
    </section>
  );
}
