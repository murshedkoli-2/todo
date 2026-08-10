"use client";

import { useEffect, useId } from "react";
import { AlertIcon, SpinnerIcon } from "@/components/ui/icons";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Destructive-action confirmation. Replaces the native `confirm()` dialog. */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel, busy]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "var(--overlay-bg)", backdropFilter: "blur(6px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-sm rounded-panel p-6 animate-scale-in bg-surface border border-line shadow-modal"
      >
        <div className="w-11 h-11 rounded-well flex items-center justify-center mb-4 bg-negative-soft text-negative-ink">
          <AlertIcon className="w-5 h-5" />
        </div>

        <h3 id={titleId} className="font-bold text-base mb-1.5 text-ink">
          {title}
        </h3>
        <p id={descriptionId} className="text-sm mb-6 leading-relaxed text-ink-secondary">
          {message}
        </p>

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={busy} className="btn-outline flex-1">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={busy} className="btn-danger flex-1">
            {busy && <SpinnerIcon className="w-4 h-4" />}
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
