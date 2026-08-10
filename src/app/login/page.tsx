"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";
import { AlertIcon, CheckIcon, SpinnerIcon } from "@/components/ui/icons";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setSuccess("Account verified. You can log in now.");
    } else if (searchParams.get("reset") === "true") {
      setSuccess("Password updated. Log in with your new password.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      description="Log in to pick up where you left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>
            Sign up
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="login-email" className="field-label">Email address</label>
          <input
            id="login-email"
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

        <div>
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
            className="input-dark"
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading && <SpinnerIcon className="w-4 h-4" />}
          {loading ? "Logging in…" : "Log in"}
        </button>
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
