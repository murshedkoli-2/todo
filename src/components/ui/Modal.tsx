"use client";

import { useEffect, useId } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface ModalProps {
  title: string;
  subtitle?: string;
  /** Tinted glyph shown to the left of the title. */
  icon?: React.ReactNode;
  iconColor?: string;
  /** Extra controls placed left of the close button, e.g. a delete action. */
  headerActions?: React.ReactNode;
  /** Sets a max height and lets `children` scroll — used by the detail modals. */
  scrollable?: boolean;
  size?: "md" | "lg";
  onClose: () => void;
  children: React.ReactNode;
}

const SIZES = { md: "sm:max-w-md", lg: "sm:max-w-xl" } as const;

/**
 * Shared modal shell: dimmed overlay, escape-to-close, body scroll lock, focus
 * trap with focus restore, and a header. Sheets from the bottom on mobile,
 * centres on `sm`+.
 */
export default function Modal({
  title, subtitle, icon, iconColor = "var(--accent)",
  headerActions, scrollable = false, size = "md", onClose, children,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal-box ${SIZES[size]} ${
          scrollable ? "flex flex-col max-h-[92vh] sm:max-h-[86vh]" : ""
        }`}
      >
        <header className="flex items-start gap-3 px-5 sm:px-6 py-4 flex-shrink-0 border-b border-line">
          {icon && (
            <span
              className="w-10 h-10 rounded-well flex items-center justify-center flex-shrink-0"
              style={{
                background: `color-mix(in srgb, ${iconColor} 14%, transparent)`,
                color: iconColor,
              }}
            >
              {icon}
            </span>
          )}

          <div className="flex-1 min-w-0 py-0.5">
            <h2 id={titleId} className="text-section truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs truncate mt-0.5 text-ink-secondary">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {headerActions}
            <button onClick={onClose} className="btn-ghost w-9 h-9 px-0" aria-label="Close">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {scrollable ? children : <div className="p-5 sm:p-6">{children}</div>}
      </div>
    </div>
  );
}
