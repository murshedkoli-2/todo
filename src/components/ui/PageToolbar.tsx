"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";

export interface SortOption {
  value: string;
  label: string;
}

interface PageToolbarProps {
  title: string;
  /** Muted count rendered beside the title, mirroring the reference header. */
  count?: number;
  subtitle?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  /** Debounced by 200 ms so typing does not re-render the grid on every key. */
  onSearchChange?: (value: string) => void;
  sortOptions?: ReadonlyArray<SortOption>;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  /** Buttons rendered at the far right of the toolbar. */
  actions?: React.ReactNode;
  /** Lets a page focus the search field from a keyboard shortcut. */
  searchRef?: React.RefObject<HTMLInputElement>;
}

const SEARCH_DEBOUNCE_MS = 200;

export default function PageToolbar({
  title,
  count,
  subtitle,
  searchValue,
  searchPlaceholder = "Search…",
  onSearchChange,
  sortOptions,
  sortValue,
  onSortChange,
  actions,
  searchRef,
}: PageToolbarProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Controlled locally so the field updates instantly while the parent is
     only notified after the debounce — and so it clears when the parent resets. */
  const [draft, setDraft] = useState(searchValue ?? "");

  useEffect(() => {
    setDraft(searchValue ?? "");
  }, [searchValue]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!onSearchChange) return;
      const { value } = e.target;
      setDraft(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onSearchChange(value), SEARCH_DEBOUNCE_MS);
    },
    [onSearchChange]
  );

  return (
    <div className="flex flex-col gap-4 mb-6 sm:mb-7">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* Title + count */}
        <div className="flex items-baseline gap-2.5 mr-auto min-w-0">
          <h1 className="text-display truncate">{title}</h1>
          {count !== undefined && (
            <span
              className="text-lg font-semibold tabular-nums flex-shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {count}
            </span>
          )}
        </div>

        {/* Search */}
        {onSearchChange && (
          <div className="relative order-last w-full lg:order-none lg:w-auto lg:flex-1 lg:max-w-xs">
            <SearchIcon
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              ref={searchRef}
              type="search"
              value={draft}
              onChange={handleSearchInput}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="input-dark pl-10"
            />
          </div>
        )}

        {/* Sort */}
        {sortOptions && sortOptions.length > 0 && (
          <label className="relative flex-shrink-0">
            <span className="sr-only">Sort by</span>
            <select
              value={sortValue}
              onChange={(e) => onSortChange?.(e.target.value)}
              className="btn-outline appearance-none pr-9 cursor-pointer"
              style={{ paddingLeft: "0.875rem" }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </label>
        )}

        {actions}
      </div>

      {subtitle && (
        <p className="text-sm -mt-1" style={{ color: "var(--text-secondary)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
