"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "@/components/ui/icons";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Optional single action, e.g. "Undo". */
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone, action?: Toast["action"]) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_AFTER_MS = 5000;
const ERROR_DISMISS_AFTER_MS = 8000;
const MAX_VISIBLE = 4;

const TONE_ICON: Record<ToastTone, React.ReactNode> = {
  success: <CheckIcon className="w-4 h-4" />,
  error: <AlertIcon className="w-4 h-4" />,
  info: <InfoIcon className="w-4 h-4" />,
};

const TONE_COLOR: Record<ToastTone, string> = {
  success: "var(--green-ink)",
  error: "var(--red-ink)",
  info: "var(--accent-ink)",
};

/**
 * Transient feedback for mutations.
 *
 * Replaces the `alert-error` block that rendered at the top of each page — a
 * failure that happened after the user scrolled was reported off-screen, so in
 * practice it was reported nowhere.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info", action?: Toast["action"]) => {
      const id = nextId.current++;
      // Errors linger: they usually need reading, and sometimes acting on.
      const lifetime = tone === "error" ? ERROR_DISMISS_AFTER_MS : DISMISS_AFTER_MS;

      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, tone, message, action }]);
      timers.current.set(id, setTimeout(() => dismiss(id), lifetime));
    },
    [dismiss]
  );

  /* Clear every pending timer on unmount so nothing fires into a dead tree. */
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message: string) => toast(message, "success"),
      error: (message: string) => toast(message, "error"),
      dismiss,
    }),
    [toast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
        `role="status"` with `aria-live="polite"` announces new toasts without
        interrupting whatever the user is doing.
      */}
      <div className="toast-viewport" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <div key={item.id} className="toast" data-tone={item.tone}>
            <span className="flex-shrink-0 mt-0.5" style={{ color: TONE_COLOR[item.tone] }}>
              {TONE_ICON[item.tone]}
            </span>

            <p className="flex-1 text-sm leading-snug text-ink">{item.message}</p>

            {item.action && (
              <button
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
                className="btn-ghost h-7 px-2 text-xs flex-shrink-0"
                style={{ color: "var(--accent-ink)" }}
              >
                {item.action.label}
              </button>
            )}

            <button
              onClick={() => dismiss(item.id)}
              className="btn-ghost w-7 h-7 px-0 flex-shrink-0"
              aria-label="Dismiss notification"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside a ToastProvider");
  return context;
}
