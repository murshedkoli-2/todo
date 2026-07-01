"use client";

import { useCallback, useRef } from "react";
import { DisplayStatus } from "@/lib/types";
import AuthButton from "@/components/AuthButton";
import ThemeToggle from "@/components/ThemeToggle";

import Image from "next/image";

const STATUS_FILTERS: Array<{ value: "all" | DisplayStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "overdue", label: "Overdue" },
];

interface MenuBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: "all" | DisplayStatus;
  onStatusFilterChange: (value: "all" | DisplayStatus) => void;
}

export default function MenuBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: MenuBarProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearchChange(value);
      }, 250);
    },
    [onSearchChange]
  );

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Top nav row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 h-14">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="relative w-8 h-8 flex-shrink-0">
              <Image src="/logo.png" alt="TaskFlow Logo" fill className="object-contain drop-shadow" />
            </div>
            <span className="font-semibold text-base hidden sm:block tracking-tight" style={{ color: "var(--text-primary)" }}>
              TaskFlow
            </span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              id="todo-search"
              type="search"
              placeholder="Search todos…"
              defaultValue={search}
              onChange={handleSearchInput}
              className="input-dark pl-9 h-9 text-sm w-full"
              aria-label="Search todos"
              style={{ borderRadius: "8px" }}
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs hidden sm:flex items-center gap-1 select-none"
              style={{ color: "var(--text-muted)" }}
            >
              <kbd className="px-1 py-0.5 rounded text-xs" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>Ctrl</kbd>
              <kbd className="px-1 py-0.5 rounded text-xs" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>K</kbd>
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Auth */}
          <AuthButton />
        </div>
      </div>

      {/* Filter pills row */}
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide"
          role="group"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            const colorMap: Record<string, string> = {
              all:         "var(--text-primary)",
              todo:        "#58a6ff",
              in_progress: "#e3b341",
              completed:   "#3fb950",
              overdue:     "#f85149",
            };
            return (
              <button
                key={f.value}
                onClick={() => onStatusFilterChange(f.value as "all" | DisplayStatus)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150"
                style={{
                  background: active ? (f.value === "all" ? "var(--active-overlay)" : `${colorMap[f.value]}22`) : "transparent",
                  color:      active ? colorMap[f.value] : "var(--text-secondary)",
                  border:     active ? `1px solid ${colorMap[f.value]}44` : "1px solid transparent",
                }}
                aria-pressed={active}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
