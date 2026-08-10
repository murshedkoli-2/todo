"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, errorMessage } from "@/lib/apiClient";
import AuthLayout from "@/components/auth/AuthLayout";
import { AlertIcon, CheckIcon, SpinnerIcon } from "@/components/ui/icons";

type Step = "request" | "reset";

/** Mirrors the `password` schema in `src/lib/schemas/common.ts`. */
const MIN_PASSWORD_LENGTH = 8;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<Step>("request");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api("/api/auth/forgot-password", { method: "POST", body: { email } });
      // The endpoint acknowledges identically whether or not the address is
      // registered, so this copy must not imply an account exists.
      setSuccess("If that email is registered, a 6-digit code is on its way.");
      setStep("reset");
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError("Password must be at least " + MIN_PASSWORD_LENGTH + " characters.");
      return;
    }

    setLoading(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: { email, code: code.trim(), password },
      });
      router.push("/login?reset=true");
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={step === "request" ? "Reset your password" : "Set a new password"}
      description={
        step === "request"
          ? "Enter your email address and we'll send you a 6-digit code."
          : `Enter the code we sent to ${email} and choose a new password.`
      }
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>
            Log in
          </Link>
        </>
      }
    >
      {error && (
        <p className="alert-error mb-4 animate-fade-in" role="alert">
          <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </p>
      )}
      {success && (
        <p className="alert-success mb-4 animate-fade-in" role="status">
          <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {success}
        </p>
      )}

      {step === "request" ? (
        <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
          <div>
            <label htmlFor="reset-email" className="field-label">Email address</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-dark"
              required
              autoFocus
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading && <SpinnerIcon className="w-4 h-4" />}
            {loading ? "Sending code…" : "Send reset code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
          <div>
            <label htmlFor="reset-code" className="field-label">Verification code</label>
            <input
              id="reset-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="input-dark text-center text-2xl font-bold tracking-[0.4em] !h-14"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="new-password" className="field-label">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-dark"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <p className="text-xs mt-1.5 text-ink-muted">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          </div>

          <div>
            <label htmlFor="confirm-new-password" className="field-label">Confirm new password</label>
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

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading && <SpinnerIcon className="w-4 h-4" />}
            {loading ? "Updating…" : "Reset password"}
          </button>

          <button
            type="button"
            onClick={() => setStep("request")}
            className="text-xs font-semibold hover:underline mx-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            Use a different email
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
