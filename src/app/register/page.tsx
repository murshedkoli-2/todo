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
const OTP_LENGTH = 6;

/** Cheap shape check only — the server is the authority on deliverability. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Rough strength readout, scored on length and character variety.
 *
 * Deliberately not a gate: the schema's only rule is the minimum length, and a
 * meter that refuses a passphrase for lacking a symbol trains people to write
 * `Passw0rd!` instead of something long. It exists to tell the user their long
 * boring password is the good one.
 */
function scorePassword(value: string): { score: number; label: string; color: string } {
  if (!value) return { score: 0, label: "", color: "var(--border)" };

  let score = 0;
  if (value.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (value.length >= 14) score += 1;
  if (/[^A-Za-z0-9]/.test(value) || (/[A-Z]/.test(value) && /[0-9]/.test(value))) score += 1;

  if (value.length < MIN_PASSWORD_LENGTH) return { score: 1, label: "Too short", color: "var(--red)" };
  if (score <= 1) return { score: 2, label: "Fair", color: "var(--yellow)" };
  if (score === 2) return { score: 3, label: "Good", color: "var(--accent)" };
  return { score: 4, label: "Strong", color: "var(--green)" };
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const strength = scorePassword(password);

  const steps: WizardStepDef[] = [
    {
      id: "you",
      label: "You",
      validate: () => {
        if (!name.trim()) return "Enter your name.";
        if (!EMAIL_PATTERN.test(email.trim())) return "Enter a valid email address.";
        return null;
      },
    },
    {
      id: "password",
      label: "Password",
      validate: () => {
        if (password.length < MIN_PASSWORD_LENGTH) {
          return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
        }
        if (password !== confirmPassword) return "The two passwords do not match.";
        return null;
      },
    },
    { id: "verify", label: "Verify" },
  ];

  const wizard = useWizard(steps);

  /*
   * The password step is gated on a server round-trip: the account is created
   * and the code emailed before the verify screen can ask for it. `advance()`
   * rather than `next()` because the caller owns that await — see the note on
   * the hook.
   */
  const handleRegister = async () => {
    if (!wizard.validateCurrent()) return;

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: { name, email: email.trim(), password },
      });
      setSuccess(`We sent a ${OTP_LENGTH}-digit verification code to ${email.trim()}.`);
      wizard.advance();
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api("/api/auth/verify-otp", { method: "POST", body: { email: email.trim(), otp: otp.trim() } });
      router.push("/login?registered=true");
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setSuccess("");
    setResending(true);

    try {
      await api("/api/auth/resend-otp", { method: "POST", body: { email: email.trim() } });
      setSuccess("A new code is on its way to your inbox.");
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (wizard.current.id === "you") { wizard.next(); return; }
    if (wizard.current.id === "password") { handleRegister(); return; }
    handleVerifyOtp();
  };

  const forwardLabel =
    wizard.current.id === "you"
      ? "Continue"
      : wizard.current.id === "password"
        ? "Create account"
        : "Verify & activate";

  const busyLabel =
    wizard.current.id === "password" ? "Sending code…" : "Verifying…";

  return (
    <AuthLayout
      title={wizard.current.id === "verify" ? "Verify your email" : "Create your account"}
      description={
        wizard.current.id === "verify"
          ? `Enter the ${OTP_LENGTH}-digit code we sent to ${email.trim()}.`
          : "Set up TaskFlow and organise your day in a couple of minutes."
      }
      footer={
        <>
          Already have an account?{" "}
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
          {wizard.current.id === "you" && (
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="reg-name" className="field-label">Full name</label>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="input-dark !h-12"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="field-label">Email address</label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-dark !h-12"
                  required
                />
                <span className="field-hint">
                  Your verification code goes here, so use an address you can open now.
                </span>
              </div>
            </div>
          )}

          {wizard.current.id === "password" && (
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="reg-password" className="field-label">Password</label>
                <input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-dark !h-12"
                  minLength={MIN_PASSWORD_LENGTH}
                  aria-describedby="reg-password-hint"
                  required
                  autoFocus
                />

                {/* Four segments rather than a continuous bar: a discrete
                    readout cannot imply a precision the score does not have. */}
                <div className="flex items-center gap-2 mt-2" aria-hidden="true">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4].map((segment) => (
                      <span
                        key={segment}
                        className="h-1 flex-1 rounded-full transition-colors duration-normal"
                        style={{
                          background: password && segment <= strength.score
                            ? strength.color
                            : "var(--bg-sunken)",
                        }}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <span className="text-[11px] font-bold" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  )}
                </div>

                <span id="reg-password-hint" className="field-hint">
                  At least {MIN_PASSWORD_LENGTH} characters. Length matters more than symbols.
                </span>
              </div>

              <div>
                <label htmlFor="reg-confirm-password" className="field-label">Confirm password</label>
                <input
                  id="reg-confirm-password"
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

          {wizard.current.id === "verify" && (
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="otp-code" className="field-label">Verification code</label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={OTP_LENGTH}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="000000"
                  className="input-dark text-center text-2xl font-bold tracking-[0.4em] !h-16"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  {resending ? "Resending…" : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => wizard.goTo(0)}
                  className="text-xs font-semibold hover:underline text-ink-secondary"
                >
                  Change email
                </button>
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
            <span>{loading ? busyLabel : forwardLabel}</span>
            {!loading && wizard.current.id === "you" && <ChevronRightIcon className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
