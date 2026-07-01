"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin]       = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { pin, redirect: false });
      if (result?.error) {
        setError("Invalid PIN. Please try again.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Glow blob */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(68,147,248,0.08) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Logo */}
      <div className="flex items-center gap-3 mb-10 select-none">
        <div className="relative w-12 h-12 flex-shrink-0">
          <Image src="/logo.png" alt="TaskFlow Logo" fill className="object-contain drop-shadow-lg" />
        </div>
        <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          TaskFlow
        </span>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-hover)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div className="px-8 py-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Welcome back
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Enter your PIN to access your dashboard.
          </p>

          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm animate-fade-in"
              style={{
                background: "rgba(248,81,73,0.1)",
                border: "1px solid rgba(248,81,73,0.3)",
                color: "var(--red)",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-pin"
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                PIN Code
              </label>
              <input
                id="login-pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••"
                className="input-dark text-center text-xl tracking-widest font-bold"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full mt-1 py-2.5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying…
                </>
              ) : "Log in"}
            </button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
        TaskFlow · Your personal task manager
      </p>
    </div>
  );
}
