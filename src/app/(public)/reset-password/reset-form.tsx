"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";
import { Card } from "@/components/ui/card";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const f: Record<string, string> = {};
    if (password.length < 8) f.password = "Password must be at least 8 characters";
    if (password !== confirm) f.confirmPassword = "Passwords do not match";
    setFields(f);
    if (Object.keys(f).length) return;
    setLoading(true);
    try {
      await api("/api/auth/reset-password", { body: { token, password, confirmPassword: confirm } });
      router.replace("/login?reset=1");
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiClientError && err.fields && (err.fields.password || err.fields.confirmPassword)) setFields(err.fields);
      else setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const strength = [password.length >= 8, /[A-Z]/.test(password) && /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="New password" htmlFor="pw" error={fields.password} required>
          <div className="relative">
            <Input
              id="pw"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              maxLength={128}
              className="pr-10"
              invalid={Boolean(fields.password)}
              leading={<KeyRound className="size-4" />}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < strength ? (strength >= 3 ? "bg-emerald-500" : "bg-amber-400") : "bg-slate-200"}`} />
            ))}
          </div>
        </Field>
        <Field label="Confirm new password" htmlFor="pw2" error={fields.confirmPassword} required>
          <Input
            id="pw2"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            maxLength={128}
            invalid={Boolean(fields.confirmPassword)}
            leading={<KeyRound className="size-4" />}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading} icon={!loading ? <ShieldCheck className="size-4" /> : undefined}>
          Update password
        </Button>
      </form>
    </Card>
  );
}
