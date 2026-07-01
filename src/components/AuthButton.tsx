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
        className="h-8 w-24 rounded-lg animate-pulse"
        style={{ background: "var(--bg-card)" }}
      />
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold select-none flex-shrink-0"
          style={{ background: "var(--accent)" }}
          title={session.user.name ?? "User"}
        >
          {session.user.name?.charAt(0).toUpperCase() ?? "U"}
        </div>
        <span
          className="text-sm font-medium hidden sm:block max-w-[100px] truncate"
          style={{ color: "var(--text-secondary)" }}
        >
          {session.user.name}
        </span>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="btn-secondary text-xs py-1.5 px-3"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="btn-secondary text-xs py-1.5 px-3"
      >
        Log in
      </Link>
      <Link
        href="/register"
        className="btn-primary text-xs py-1.5 px-3"
      >
        Sign up
      </Link>
    </div>
  );
}
