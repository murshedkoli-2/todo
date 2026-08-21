"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";
import Stepper from "@/components/ui/wizard/Stepper";
import WizardPanel from "@/components/ui/wizard/WizardPanel";
import { useWizard, WizardStepDef } from "@/components/ui/wizard/useWizard";
import {
  AlertIcon, CheckIcon, SpinnerIcon, ChevronLeftIcon, ChevronRightIcon,
} from "@/components/ui/icons";

/** Cheap shape check only — the server is the authority on whether it exists. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Log in, as two steps: identify yourself, then prove it.
 *
 * Splitting a two-field form looks like ceremony until you notice what the
 * second screen can then do — it names the account being entered, so a typo in
 * the address is caught before the password is typed rather than surfacing as
 * "incorrect email or password" afterwards, which is the least useful error
 * message in software.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    { id: "password", label: "Password" },
  ];

  const wizard = useWizard(steps);

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setSuccess("Account verified. You can log in now.");
    } else if (searchParams.get("reset") === "true") {
      setSuccess("Password updated. Log in with your new password.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizard.isLast) { wizard.next(); return; }
    if (!password) { setError("Enter your password."); return; }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        // NextAuth wraps the provider message; the unverified case is the only
        // one worth distinguishing, since it has a different remedy.
        setError(
          result.error.includes("verify your email")
            ? "This email is not verified yet. Register again to receive a new code."
            : "Incorrect email or password. Please try again."
        );
        setLoading(false);
        return;
      }

      // `middleware.ts` stashes the blocked destination here so login can
      // return the user to where they were headed.
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(callbackUrl?.startsWith("/") ? callbackUrl : "/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      description={
        wizard.isLast
          ? "One more thing — your password."
          : "Log in to pick up where you left off."
      }
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>
            Sign up
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
          {wizard.current.id === "email" ? (
            <div>
              <label htmlFor="login-email" className="field-label">Email address</label>
              <input
                id="login-email"
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
          ) : (
            <div>
              {/* Naming the account here is the point of the split. */}
              <div className="well px-3.5 py-2.5 mb-4 flex items-center justify-between gap-3">
                <span className="text-sm font-medium truncate text-ink">{email.trim()}</span>
                <button
                  type="button"
                  onClick={wizard.back}
                  className="text-xs font-semibold flex-shrink-0 hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  Change
                </button>
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="field-label !mb-0">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-dark !h-12"
                required
                autoFocus
              />
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
            <span>{loading ? "Logging in…" : wizard.isLast ? "Log in" : "Continue"}</span>
            {!wizard.isLast && <ChevronRightIcon className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "var(--bg-content)", color: "var(--accent)" }}
        >
          <SpinnerIcon className="w-7 h-7" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
