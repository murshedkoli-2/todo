"use client";

import {
  Todo, DisplayStatus, getDisplayStatus, STATUS_LABELS,
  STATUS_COLORS, STATUS_TEXT_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TEXT_COLORS,
} from "@/lib/types";
import type { TodoStatus } from "@/lib/schemas/todo";
import Avatar from "@/components/ui/Avatar";
import Money from "@/components/ui/Money";
import TaskCover from "@/components/ui/TaskCover";
import { useMenu } from "@/hooks/useMenu";
import {
  CalendarIcon, ImageIcon, EditIcon, CheckIcon, MoreIcon, SpinnerIcon,
} from "@/components/ui/icons";

interface TodoCardProps {
  todo: Todo;
  onEdit?: (todo: Todo) => void;
  onView?: (todo: Todo) => void;
  onStatusChange?: (id: string, status: TodoStatus) => void;
  /** True while a status change for this card is in flight. */
  pending?: boolean;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: TodoStatus; label: string }> = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

/** Soft wash used behind the card's status header. */
const statusTint = (color: string) => `color-mix(in srgb, ${color} 13%, transparent)`;

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Days until the due date. Negative when overdue — this is a real signal, and
 * it replaces the invented completion percentage the card used to show
 * (`in_progress` was hard-coded to 55%, which meant nothing to anyone).
 */
function daysUntil(dueDate: string): number {
  const MS_PER_DAY = 86_400_000;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const startOfDue = new Date(dueDate).setHours(0, 0, 0, 0);
  return Math.round((startOfDue - startOfToday) / MS_PER_DAY);
}

function dueLabel(dueDate: string, displayStatus: DisplayStatus): string {
  if (displayStatus === "completed") return formatDate(dueDate);
  const days = daysUntil(dueDate);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day late";
  if (days < 0) return `${Math.abs(days)} days late`;
  if (days <= 7) return `Due in ${days} days`;
  return formatDate(dueDate);
}

export default function TodoCard({
  todo, onEdit, onView, onStatusChange, pending = false,
}: TodoCardProps) {
  const menu = useMenu(STATUS_OPTIONS.length);

  const displayStatus = getDisplayStatus(todo);
  const statusColor = STATUS_COLORS[displayStatus];
  const statusInk = STATUS_TEXT_COLORS[displayStatus];
  const isOverdue = displayStatus === "overdue";

  const handleStatusChange = (nextStatus: TodoStatus) => {
    menu.close();
    if (nextStatus !== todo.status) onStatusChange?.(todo._id, nextStatus);
  };

  return (
    <article
      className="card-tile group !p-0 overflow-hidden"
      aria-labelledby={`task-title-${todo._id}`}
    >
      {/*
        Every card carries a cover, falling back to the shared default image
        when the task has no upload, so the grid keeps a single card shape
        instead of two.
      */}
      <TaskCover src={todo.featureImage} className="h-32 flex-shrink-0" />

      <header
        className="flex items-center gap-2.5 px-4 h-11 flex-shrink-0 border-b border-line"
        style={{
          // Flat base first so browsers without `color-mix` get a band rather
          // than a transparent strip.
          background: "var(--bg-sunken)",
          backgroundImage: `linear-gradient(${statusTint(statusColor)}, ${statusTint(statusColor)})`,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: statusColor }}
        />
        <span
          className="text-[11px] font-bold uppercase tracking-[0.08em] truncate"
          style={{ color: statusInk }}
        >
          {STATUS_LABELS[displayStatus]}
        </span>

        <span className="flex-1" />

        <Avatar name={todo.ownerName} variant="square" size="sm" solid className="flex-shrink-0" />
      </header>

      <div className="flex flex-col flex-1 p-4 sm:p-5">
        {/*
          The whole card is not a click target any more. A clickable <article>
          containing buttons meant every inner control needed stopPropagation,
          and the card itself was unreachable by keyboard. The title is the
          link; `after:absolute` stretches its hit area over the card while
          leaving the real buttons on top of it.
        */}
        <h3 id={`task-title-${todo._id}`} className="font-bold text-[17px] leading-snug tracking-tight">
          <button
            type="button"
            onClick={() => onView?.(todo)}
            className="text-left line-clamp-2 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {todo.title}
          </button>
        </h3>

        {todo.description && (
          <p className="text-[13px] leading-relaxed line-clamp-2 mt-1.5 text-ink-secondary">
            {todo.description}
          </p>
        )}

        {(todo.dueDate || todo.paymentAmountMinor != null || todo.images.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {todo.dueDate && (
              <span
                className="pill"
                style={{
                  background: isOverdue ? "var(--red-soft)" : "var(--bg-sunken)",
                  color: isOverdue ? "var(--red-ink)" : "var(--text-secondary)",
                }}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                {dueLabel(todo.dueDate, displayStatus)}
              </span>
            )}

            {todo.images.length > 0 && (
              <span className="pill bg-sunken text-ink-secondary">
                <ImageIcon className="w-3.5 h-3.5" />
                {todo.images.length}
              </span>
            )}
          </div>
        )}

        <div className="flex-1 min-h-[12px]" />

        <div className="flex items-center gap-2 pt-3.5 mt-3.5 border-t border-line">
          {todo.paymentAmountMinor != null ? (
            <span className="flex items-baseline gap-2 min-w-0">
              <Money
                minor={todo.paymentAmountMinor}
                currency={todo.paymentCurrency}
                size="md"
                tone="neutral"
                compact
              />
              <span
                className="text-[11px] font-semibold uppercase tracking-wide flex-shrink-0"
                style={{ color: PAYMENT_STATUS_TEXT_COLORS[todo.paymentStatus] }}
              >
                {PAYMENT_STATUS_LABELS[todo.paymentStatus]}
              </span>
            </span>
          ) : (
            <span className="text-xs text-ink-muted">No payment</span>
          )}

          <span className="flex-1" />

          {/* Relative z-index lifts the controls above the title's stretched hit area. */}
          <div className="relative z-10 flex items-center gap-0.5 flex-shrink-0">
            <div className="relative" ref={menu.containerRef}>
              <button
                ref={menu.triggerRef}
                onClick={menu.toggle}
                onKeyDown={menu.handleKeyDown}
                disabled={pending}
                className="btn-ghost w-8 h-8 px-0"
                aria-label={`Change status of ${todo.title}`}
                aria-haspopup="menu"
                aria-expanded={menu.open}
              >
                {pending ? <SpinnerIcon className="w-4 h-4" /> : <MoreIcon className="w-4 h-4" />}
              </button>

              {menu.open && (
                <div
                  role="menu"
                  aria-label="Task status"
                  onKeyDown={menu.handleKeyDown}
                  className="absolute bottom-full right-0 mb-2 w-40 rounded-well overflow-hidden z-20 animate-scale-in bg-surface border border-line shadow-popup"
                >
                  {STATUS_OPTIONS.map((option, index) => {
                    const selected = todo.status === option.value;
                    const highlighted = menu.activeIndex === index;
                    return (
                      <button
                        key={option.value}
                        role="menuitemradio"
                        aria-checked={selected}
                        tabIndex={highlighted ? 0 : -1}
                        ref={(element) => {
                          if (highlighted) element?.focus();
                        }}
                        onClick={() => handleStatusChange(option.value)}
                        onMouseMove={() => menu.setActiveIndex(index)}
                        className="flex items-center justify-between gap-2 w-full text-left px-3.5 py-2.5 text-xs font-medium"
                        style={{
                          color: selected ? "var(--accent-ink)" : "var(--text-primary)",
                          background: highlighted
                            ? "var(--hover-overlay)"
                            : selected
                            ? "var(--accent-soft)"
                            : "transparent",
                        }}
                      >
                        {option.label}
                        {selected && <CheckIcon className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => onEdit?.(todo)}
              className="btn-ghost w-8 h-8 px-0"
              aria-label={`Edit ${todo.title}`}
            >
              <EditIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
