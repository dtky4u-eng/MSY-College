"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, MailCheck, Send, User } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";
import { Card } from "@/components/ui/card";

export function ForgotForm({ devOutbox }: { devOutbox: boolean }) {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErr(null);
    if (!identifier.trim()) {
      setFieldErr("Enter your username, email or registration number");
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ message: string }>("/api/auth/forgot-password", { body: { identifier: identifier.trim() } });
      setSent(res.message);
    } catch (err) {
      if (err instanceof ApiClientError && err.fields?.identifier) setFieldErr(err.fields.identifier);
      else setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Card className="p-6 text-center sm:p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <MailCheck className="size-6" />
        </div>
        <h2 className="mt-3 text-lg font-bold text-slate-900">Check your email</h2>
        <p className="mt-2 text-sm text-slate-600" role="status">
          {sent}
        </p>
        {devOutbox && (
          <Alert tone="info" className="mt-4 text-left">
            Development mode: emails are not sent — they are written to <code className="font-mono">storage/outbox</code>.
          </Alert>
        )}
        <p className="mt-5 text-xs text-slate-500">Didn&apos;t get it? Check your spam folder, or contact your college to update your email.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="outline" onClick={() => setSent(null)}>
            Try another identifier
          </Button>
          <Link href="/login" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
            Back to login
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Username, email or registration number" htmlFor="identifier" error={fieldErr} required>
          <Input
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            autoFocus
            maxLength={120}
            placeholder="e.g. MSY26000123"
            invalid={Boolean(fieldErr)}
            leading={<User className="size-4" />}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading} icon={!loading ? <Send className="size-4" /> : undefined}>
          Send reset link
        </Button>
        <Link href="/login" className="flex items-center justify-center gap-1 text-sm font-medium text-slate-600 hover:text-brand-700">
          <ArrowLeft className="size-4" /> Back to login
        </Link>
      </form>
    </Card>
  );
}
