"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, errorMessage } from "@/lib/apiClient";
import AuthLayout from "@/components/auth/AuthLayout";
import { AlertIcon, CheckIcon, SpinnerIcon } from "@/components/ui/icons";

type Step = "register" | "otp";

/** Mirrors the `password` schema in `src/lib/schemas/common.ts`. */
const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("register");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
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
      await api("/api/auth/register", { method: "POST", body: { name, email, password } });
      setSuccess("We sent a 6-digit verification code to your email.");
      setStep("otp");
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api("/api/auth/verify-otp", { method: "POST", body: { email, otp: otp.trim() } });
      router.push("/login?registered=true");
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setSuccess("");
    setResending(true);

    try {
      await api("/api/auth/resend-otp", { method: "POST", body: { email } });
      setSuccess("A new code is on its way to your inbox.");
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title={step === "register" ? "Create your account" : "Verify your email"}
      description={
        step === "register"
          ? "Set up TaskFlow and organise your day in a couple of minutes."
          : `Enter the 6-digit code we sent to ${email}.`
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

      {step === "register" ? (
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div>
            <label htmlFor="reg-name" className="field-label">Full name</label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="input-dark"
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
              className="input-dark"
              required
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="field-label">Password</label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-dark"
              minLength={MIN_PASSWORD_LENGTH}
              aria-describedby="reg-password-hint"
              required
            />
            <p id="reg-password-hint" className="text-xs mt-1.5 text-ink-muted">
              At least {MIN_PASSWORD_LENGTH} characters. Length matters more than symbols.
            </p>
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
              className="input-dark"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading && <SpinnerIcon className="w-4 h-4" />}
            {loading ? "Sending code…" : "Create account"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
          <div>
            <label htmlFor="otp-code" className="field-label">Verification code</label>
            <input
              id="otp-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="000000"
              className="input-dark text-center text-2xl font-bold tracking-[0.4em] !h-14"
              required
              autoFocus
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
            {loading && <SpinnerIcon className="w-4 h-4" />}
            {loading ? "Verifying…" : "Verify & activate"}
          </button>

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
              onClick={() => setStep("register")}
              className="text-xs font-semibold hover:underline"
              style={{ color: "var(--text-secondary)" }}
            >
              Change email
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
