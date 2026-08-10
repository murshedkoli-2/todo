"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/components/ThemeContext";
import Avatar from "@/components/ui/Avatar";
import {
  ChevronDownIcon, SignOutIcon, SunIcon, MoonIcon, SpinnerIcon,
} from "@/components/ui/icons";

/**
 * The profile block pinned to the bottom of the sidebar. Opens a popover with
 * the theme switch and sign-out. Signed-out visitors get log in / sign up.
 */
export default function UserMenu() {
  const { data: session, status } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  };

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
        <div className="skeleton h-3 w-24 rounded-full" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col gap-2 px-3">
        <Link href="/login" className="btn-outline w-full">Log in</Link>
        <Link href="/register" className="btn-primary w-full">Create account</Link>
      </div>
    );
  }

  const name = session.user.name ?? "User";
  const isDark = theme === "dark";

  return (
    <div ref={containerRef} className="relative px-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 w-full rounded-control px-2 py-2 text-left"
        style={{ color: "var(--text-primary)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-overlay)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar name={name} solid size="md" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold truncate">{name}</span>
          <span className="block text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {session.user.email}
          </span>
        </span>
        <ChevronDownIcon
          className="w-4 h-4 flex-shrink-0 transition-transform"
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-3 right-3 mb-2 rounded-well overflow-hidden animate-scale-in z-50"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-popup)",
          }}
        >
          <button
            role="menuitem"
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-overlay)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            {isDark ? "Light mode" : "Dark mode"}
          </button>

          <div style={{ height: 1, background: "var(--border)" }} />

          <button
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium"
            style={{ color: "var(--red)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--red-soft)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {signingOut
              ? <SpinnerIcon className="w-4 h-4" />
              : <SignOutIcon className="w-4 h-4" />}
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
