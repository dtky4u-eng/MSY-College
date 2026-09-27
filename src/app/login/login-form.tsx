"use client";
import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, KeyRound, LogIn, User } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";

export function LoginForm({ next, expired, reset }: { next?: string; expired?: boolean; reset?: boolean }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPaymentPending(false);
    setLoading(true);
    try {
      const res = await api<{ redirect: string; role: string }>("/api/auth/login", { body: { identifier, password } });
      const home = res.redirect;
      // Only follow ?next= when it belongs to the signed-in user's own portal.
      window.location.href = next && next.startsWith(home) ? next : home;
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiClientError && err.fields?.code === "PAYMENT_PENDING") setPaymentPending(true);
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {expired && !error && <Alert tone="info">Your session has ended. Please sign in again.</Alert>}
      {reset && !error && <Alert tone="success">Password updated. Sign in with your new password.</Alert>}
      {error && (
        <Alert
          tone={paymentPending ? "warning" : "error"}
          action={
            paymentPending ? (
              <ButtonLink href="/register" size="sm" variant="outline">
                Complete registration
              </ButtonLink>
            ) : undefined
          }
        >
          {error}
        </Alert>
      )}
      <Field label="Username, email or registration number" htmlFor="identifier">
        <Input
          id="identifier"
          autoComplete="username"
          autoFocus
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="e.g. MSY26000123"
          leading={<User className="size-4" />}
          required
        />
      </Field>
      <Field
        label={
          <span className="flex items-center justify-between">
            Password
            <Link href="/forgot-password" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Forgot password?
            </Link>
          </span>
        }
        htmlFor="password"
      >
        <div className="relative">
          <Input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            leading={<KeyRound className="size-4" />}
            className="pr-10"
            required
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!identifier || !password} icon={<LogIn className="size-4" />}>
        Sign in
      </Button>
      <p className="text-center text-xs text-slate-500">Students, colleges, mentors and administrators all sign in here — you&apos;ll be taken to your own portal.</p>
    </form>
  );
}
