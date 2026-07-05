"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function AuthButton() {
  const { data: session, status } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading") {
    return (
      <div
        className="h-8 w-8 rounded-full animate-pulse flex-shrink-0"
        style={{ background: "var(--bg-card)" }}
      />
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold select-none flex-shrink-0"
          style={{ background: "var(--accent)" }}
          title={session.user.name ?? "User"}
        >
          {session.user.name?.charAt(0).toUpperCase() ?? "U"}
        </div>

        {/* Name — only visible sm+ */}
        <span
          className="text-sm font-medium hidden sm:block max-w-[90px] truncate"
          style={{ color: "var(--text-secondary)" }}
        >
          {session.user.name}
        </span>

        {/* Sign out — icon only on xs, text on sm+ */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="btn-secondary text-xs py-1.5 px-2 sm:px-3 flex items-center gap-1"
          aria-label="Sign out"
          title="Sign out"
        >
          {signingOut ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="hidden sm:inline">Signing out…</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Sign out</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Link
        href="/login"
        className="btn-secondary text-xs py-1.5 px-2.5 sm:px-3"
      >
        Log in
      </Link>
      <Link
        href="/register"
        className="btn-primary text-xs py-1.5 px-2.5 sm:px-3"
      >
        <span className="hidden sm:inline">Sign up</span>
        <span className="sm:hidden">Join</span>
      </Link>
    </div>
  );
}
