"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, CheckCircle2, Eye, EyeOff, IdCard, KeyRound, LogIn, Info } from "lucide-react";
import { api } from "@/lib/client/api";
import { useT } from "@/components/i18n";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import type { RegState, VerifyResponse } from "./types";
import { errFields, errText } from "./util";

export function StepVerify({ onVerified, expired }: { onVerified: (s: RegState) => void; expired?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [regNo, setRegNo] = useState("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [already, setAlready] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (needsPassword) pwRef.current?.focus();
  }, [needsPassword]);

  useEffect(() => {
    if (!already) return;
    const id = setTimeout(() => router.push("/login"), 3500);
    return () => clearTimeout(id);
  }, [already, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErr({});
    if (!regNo.trim()) {
      setFieldErr({ registrationNumber: t("reg.verify.required") });
      return;
    }
    if (needsPassword && !password) {
      setFieldErr({ password: t("reg.v.required") });
      return;
    }
    setLoading(true);
    try {
      const res = await api<VerifyResponse>("/api/register/verify", {
        body: { registrationNumber: regNo, ...(needsPassword ? { password } : {}) },
      });
      if ("alreadyRegistered" in res) {
        setAlready(true);
      } else if ("needsPassword" in res) {
        setNeedsPassword(true);
      } else {
        onVerified(res.state);
        return;
      }
    } catch (err) {
      const msg = errText(err, t);
      const f = errFields(err);
      if (f.password) setFieldErr({ password: msg });
      else if (f.registrationNumber) setFieldErr({ registrationNumber: msg });
      else setError(msg);
    }
    setLoading(false);
  };

  if (already) {
    return (
      <Card className="p-6 text-center sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <BadgeCheck className="size-7" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">{t("reg.verify.alreadyTitle")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{t("reg.verify.alreadyDesc")}</p>
        <p className="mt-2 text-xs text-slate-400">{t("reg.verify.redirecting")}</p>
        <ButtonLink href="/login" size="lg" className="mt-6" icon={<LogIn className="size-4" />}>
          {t("reg.verify.goLogin")}
        </ButtonLink>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <Card className="p-5 sm:p-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <IdCard className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{needsPassword ? t("reg.verify.passwordTitle") : t("reg.verify.title")}</h2>
            <p className="mt-1 text-sm text-slate-500">{needsPassword ? t("reg.verify.passwordDesc") : t("reg.verify.desc")}</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-5" noValidate>
          {expired && !error && <Alert tone="warning">{t("reg.sessionExpired")}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}
          <Field label={t("reg.verify.label")} htmlFor="regNo" error={fieldErr.registrationNumber} hint={t("reg.verify.hint")} required>
            <Input
              id="regNo"
              value={regNo}
              onChange={(e) => {
                setRegNo(e.target.value.toUpperCase());
                if (needsPassword) {
                  setNeedsPassword(false);
                  setPassword("");
                }
              }}
              placeholder={t("reg.verify.placeholder")}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              maxLength={60}
              invalid={Boolean(fieldErr.registrationNumber)}
              aria-invalid={Boolean(fieldErr.registrationNumber)}
              className="h-12 font-mono text-base tracking-wide"
              leading={<IdCard className="size-4" />}
            />
          </Field>
          {needsPassword && (
            <Field
              label={
                <span className="flex items-center justify-between">
                  {t("reg.verify.password")}
                  <Link href="/forgot-password" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    {t("reg.verify.forgot")}
                  </Link>
                </span>
              }
              htmlFor="regPw"
              error={fieldErr.password}
              required
            >
              <div className="relative">
                <Input
                  ref={pwRef}
                  id="regPw"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  invalid={Boolean(fieldErr.password)}
                  className="h-12 pr-11"
                  leading={<KeyRound className="size-4" />}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600"
                  aria-label={showPw ? t("reg.f.hidePassword") : t("reg.f.showPassword")}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
          )}
          <Button type="submit" size="lg" className="w-full" loading={loading} icon={!loading ? <ArrowRight className="size-4" /> : undefined}>
            {needsPassword ? t("reg.verify.resume") : t("reg.verify.submit")}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {t("reg.haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            {t("reg.login")}
          </Link>
        </p>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t("reg.verify.checklistTitle")}</h3>
          <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                <span>{t(`reg.verify.checklist${n}`)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <Info className="size-4" /> {t("reg.verify.whereTitle")}
          </p>
          <p className="mt-1.5 text-sky-800">{t("reg.verify.whereDesc")}</p>
        </div>
      </div>
    </div>
  );
}
