"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, errorMessage } from "@/lib/apiClient";
import AuthLayout from "@/components/auth/AuthLayout";
import Stepper from "@/components/ui/wizard/Stepper";
import WizardPanel from "@/components/ui/wizard/WizardPanel";
import { useWizard, WizardStepDef } from "@/components/ui/wizard/useWizard";
import {
  AlertIcon, CheckIcon, SpinnerIcon, ChevronLeftIcon, ChevronRightIcon,
} from "@/components/ui/icons";

/** Mirrors the `password` schema in `src/lib/schemas/common.ts`. */
const MIN_PASSWORD_LENGTH = 8;
const CODE_LENGTH = 6;

/** Cheap shape check only — the server is the authority on deliverability. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password reset, as three steps: identify, prove, replace.
 *
 * The code and the new password used to share one screen, which asked the user
 * to switch between their inbox and a password manager without losing either
 * field. Separating them means each screen has exactly one thing to paste into.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const steps: WizardStepDef[] = [
    {
      id: "email",
      label: "Email",
      validate: () =>
        EMAIL_PATTERN.test(email.trim()) ? null : "Enter a valid email address.",
    },
    {
      id: "code",
      label: "Code",
      validate: () =>
        code.trim().length === CODE_LENGTH
          ? null
          : `Enter the ${CODE_LENGTH}-digit code from your email.`,
    },
    { id: "password", label: "New password" },
  ];

  const wizard = useWizard(steps);

  /*
   * Gated on a server round-trip, so `advance()` rather than `next()` — the
   * caller owns the await. See the note on the hook.
   */
  const handleRequestCode = async () => {
    if (!wizard.validateCurrent()) return;

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await api("/api/auth/forgot-password", { method: "POST", body: { email: email.trim() } });
      // The endpoint acknowledges identically whether or not the address is
      // registered, so this copy must not imply an account exists.
      setSuccess(`If that email is registered, a ${CODE_LENGTH}-digit code is on its way.`);
      wizard.advance();
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    setSuccess("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: { email: email.trim(), code: code.trim(), password },
      });
      router.push("/login?reset=true");
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (wizard.current.id === "email") { handleRequestCode(); return; }
    if (wizard.current.id === "code") { setError(""); wizard.next(); return; }
    handleResetPassword();
  };

  const forwardLabel =
    wizard.current.id === "email"
      ? "Send reset code"
      : wizard.current.id === "code"
        ? "Continue"
        : "Reset password";

  const DESCRIPTIONS: Record<string, string> = {
    email: "Enter your email address and we'll send you a 6-digit code.",
    code: `Enter the ${CODE_LENGTH}-digit code we sent to ${email.trim()}.`,
    password: "Choose a new password. You'll be logged out everywhere else.",
  };

  return (
    <AuthLayout
      title={wizard.current.id === "password" ? "Set a new password" : "Reset your password"}
      description={DESCRIPTIONS[wizard.current.id]}
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>
            Log in
          </Link>
        </>
      }
    >
      <div className="mb-5">
        <Stepper wizard={wizard} compact />
      </div>

      {(error || wizard.error) && (
        <p className="alert-error mb-4 animate-fade-in" role="alert">
          <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error || wizard.error}
        </p>
      )}
      {success && (
        <p className="alert-success mb-4 animate-fade-in" role="status">
          <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {success}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <WizardPanel wizard={wizard}>
          {wizard.current.id === "email" && (
            <div>
              <label htmlFor="reset-email" className="field-label">Email address</label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-dark !h-12"
                required
                autoFocus
              />
            </div>
          )}

          {wizard.current.id === "code" && (
            <div>
              <label htmlFor="reset-code" className="field-label">Verification code</label>
              <input
                id="reset-code"
                type="text"
                inputMode="numeric"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                className="input-dark text-center text-2xl font-bold tracking-[0.4em] !h-16"
                required
                autoFocus
              />
              <span className="field-hint text-center">
                Codes expire quickly — request a new one from the previous step if it has.
              </span>
            </div>
          )}

          {wizard.current.id === "password" && (
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="new-password" className="field-label">New password</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-dark !h-12"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  autoFocus
                />
                <span className="field-hint">At least {MIN_PASSWORD_LENGTH} characters.</span>
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
                  className="input-dark !h-12"
                  required
                />
              </div>
            </div>
          )}
        </WizardPanel>

        <div className="flex items-center gap-3 mt-5">
          {!wizard.isFirst && (
            <button type="button" onClick={wizard.back} disabled={loading} className="btn-outline">
              <ChevronLeftIcon className="w-4 h-4" />
              Back
            </button>
          )}
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading && <SpinnerIcon className="w-4 h-4" />}
            <span>{loading ? "Working…" : forwardLabel}</span>
            {!loading && wizard.current.id === "code" && <ChevronRightIcon className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
