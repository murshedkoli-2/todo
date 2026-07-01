"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send reset code");
      } else {
        setSuccess("Password reset code sent to your email.");
        setStep("reset");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed");
      } else {
        router.push("/login?reset=true");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Glow blob */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(188,76,0,0.06) 0%, transparent 70%)",
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
        className="w-full max-w-md rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-hover)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <div className="px-8 py-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            {step === "request" ? "Reset your password" : "Set new password"}
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            {step === "request"
              ? "Enter your email address and we'll send you a 6-digit code to reset your password."
              : `We sent a 6-digit verification code to ${email}.`}
          </p>

          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm animate-fade-in"
              style={{
                background: "rgba(248,81,73,0.08)",
                border: "1px solid rgba(248,81,73,0.25)",
                color: "var(--red)",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm animate-fade-in"
              style={{
                background: "rgba(63,185,80,0.08)",
                border: "1px solid rgba(63,185,80,0.25)",
                color: "var(--green)",
              }}
            >
              {success}
            </div>
          )}

          {step === "request" ? (
            <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="reset-email"
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Email Address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="input-dark"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full mt-2 py-2.5"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending code…
                  </>
                ) : (
                  "Send reset code"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="reset-code"
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Verification Code (OTP)
                </label>
                <input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="input-dark text-center text-2xl tracking-widest font-bold"
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="new-password"
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-dark"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirm-new-password"
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Confirm New Password
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-dark"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full mt-2 py-2.5"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Resetting password…
                  </>
                ) : (
                  "Reset password"
                )}
              </button>

              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => setStep("request")}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Request new code / change email
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            Remembered your password?{" "}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>
              Log in
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-8 text-xs" style={{ color: "var(--text-muted)" }}>
        TaskFlow · Your personal task manager
      </p>
    </div>
  );
}
