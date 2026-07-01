"use client";

import { useState } from "react";
import Image from "next/image";
import { Todo, getDisplayStatus, STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/lib/types";

interface TodoCardProps {
  todo: Todo;
  onEdit?: (todo: Todo) => void;
  onView?: (todo: Todo) => void;
  onStatusChange?: (id: string, status: string) => void;
}

const STATUS_OPTIONS = [
  { value: "todo",        label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed" },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STRIP_COLOR: Record<string, string> = {
  todo:         "#4493f8",
  in_progress:  "#e3b341",
  completed:    "#3fb950",
  overdue:      "#f85149",
};

export default function TodoCard({ todo, onEdit, onView, onStatusChange }: TodoCardProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [hovered, setHovered] = useState(false);

  const displayStatus  = getDisplayStatus(todo);
  const dueDateFormatted = todo.dueDate ? formatDate(todo.dueDate) : null;
  const isPastDue      = todo.dueDate && new Date(todo.dueDate) < new Date();
  const createdAgo     = timeAgo(todo.createdAt);
  const stripColor     = STRIP_COLOR[displayStatus];
  const hasFeatureImg  = Boolean(todo.featureImage);

  const handleStatusChange = async (newStatus: string) => {
    if (!onStatusChange) return;
    setIsChangingStatus(true);
    setShowStatusMenu(false);
    await onStatusChange(todo._id, newStatus);
    setIsChangingStatus(false);
  };

  return (
    <article
      className="animate-fade-in-up relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer group"
      style={{
        background:  hovered ? "var(--bg-card-hover)" : "var(--bg-card)",
        border:      `1px solid ${hovered ? "var(--border-hover)" : "var(--border)"}`,
        boxShadow:   hovered
          ? "0 8px 28px rgba(0,0,0,0.45)"
          : "0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.25)",
      }}
      onClick={() => onView?.(todo)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Todo: ${todo.title}`}
    >
      {/* ── Feature image OR colored strip ─────────── */}
      {hasFeatureImg ? (
        <div className="relative w-full h-40 flex-shrink-0 overflow-hidden">
          <Image
            src={todo.featureImage!}
            alt={todo.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
          {/* Gradient overlay for readability */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%)" }}
          />
          {/* Status badge on image */}
          <div className="absolute bottom-2 left-3">
            <span
              className={`badge-${displayStatus} inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold`}
              style={{ backdropFilter: "blur(6px)" }}
            >
              {STATUS_LABELS[displayStatus]}
            </span>
          </div>
          {/* Image count badge */}
          {todo.images.length > 1 && (
            <div
              className="absolute bottom-2 right-3 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.8)" }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {todo.images.length}
            </div>
          )}
        </div>
      ) : (
        <div className="h-1 w-full flex-shrink-0" style={{ background: stripColor }} />
      )}

      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Top row: badge (only when no feature image) + owner avatar */}
        {!hasFeatureImg && (
          <div className="flex items-start justify-between gap-2">
            <span className={`badge-${displayStatus} inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold`}>
              {STATUS_LABELS[displayStatus]}
            </span>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 select-none"
              style={{ background: "var(--accent)", fontSize: "11px" }}
              title={todo.ownerName}
            >
              {todo.ownerName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Title */}
        <h3
          className="font-semibold text-sm leading-snug line-clamp-2 transition-colors duration-150"
          style={{ color: hovered ? "var(--accent-hover)" : "var(--text-primary)" }}
        >
          {todo.title}
        </h3>

        {/* Description */}
        {todo.description && (
          <p
            className="text-xs leading-relaxed line-clamp-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {todo.description}
          </p>
        )}

        <div className="flex-1" />

        {/* Due date */}
        {dueDateFormatted && (
          <div
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: isPastDue && todo.status !== "completed" ? "var(--red)" : "var(--text-muted)" }}
          >
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {isPastDue && todo.status !== "completed" ? "Overdue · " : "Due · "}
            {dueDateFormatted}
          </div>
        )}

        {/* Payment badge */}
        {todo.paymentAmount != null && (
          <div
            className="flex items-center gap-1.5 text-xs font-medium"
            title={`Payment: ${todo.paymentStatus}`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: PAYMENT_STATUS_COLORS[todo.paymentStatus] }}
            />
            <span style={{ color: PAYMENT_STATUS_COLORS[todo.paymentStatus] }}>
              {todo.paymentCurrency} {todo.paymentAmount.toLocaleString()}
            </span>
            <span style={{ color: "var(--text-muted)" }}>
              · {todo.paymentStatus.charAt(0).toUpperCase() + todo.paymentStatus.slice(1)}
            </span>
          </div>
        )}

        <div
          className="flex items-center gap-2 pt-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span className="text-xs flex-1 truncate" style={{ color: "var(--text-muted)" }}>
            {todo.ownerName} · {createdAgo}
          </span>

          {/* Images indicator (when no feature image but has images) */}
          {!hasFeatureImg && todo.images.length > 0 && (
            <div
              className="flex items-center gap-1 text-xs"
              style={{ color: "var(--text-muted)" }}
              title={`${todo.images.length} image${todo.images.length > 1 ? "s" : ""}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {todo.images.length}
            </div>
          )}

          {/* Status button */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowStatusMenu(v => !v); }}
              disabled={isChangingStatus}
              className="btn-ghost text-xs py-1 px-2 gap-1"
              aria-label="Change status"
              aria-expanded={showStatusMenu}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isChangingStatus ? "…" : "Status"}
            </button>

            {showStatusMenu && (
              <div
                className="absolute bottom-full right-0 mb-2 w-36 rounded-xl overflow-hidden z-20 animate-scale-in"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-hover)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                    className="w-full text-left px-3 py-2 text-xs font-medium transition-colors duration-100"
                    style={{
                      color: todo.status === opt.value ? "var(--accent)" : "var(--text-primary)",
                      background: todo.status === opt.value ? "var(--accent-dim)" : "transparent",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = todo.status === opt.value ? "var(--accent-dim)" : "transparent")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Edit button */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.(todo); }}
            className="btn-ghost text-xs py-1 px-2 gap-1"
            aria-label="Edit todo"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Overlay to close status menu */}
      {showStatusMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowStatusMenu(false)}
          aria-hidden="true"
        />
      )}
    </article>
  );
}
