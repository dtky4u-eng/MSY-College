"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, AtSign, Eye, EyeOff, GraduationCap, KeyRound, Lock, Mail, Phone, User } from "lucide-react";
import { api } from "@/lib/client/api";
import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import type { RegState } from "./types";
import { errFields, errText } from "./util";

type Form = {
  fatherName: string;
  gender: string;
  dob: string;
  programme: string;
  majorSubject: string;
  session: string;
  semester: string;
  mobile: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
};

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&>svg]:size-4">{icon}</span>
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          {desc && <p className="text-xs text-slate-500">{desc}</p>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function StepDetails({ state, onSaved, onBack, onError }: { state: RegState; onSaved: (s: RegState) => void; onBack?: () => void; onError: (e: unknown) => boolean }) {
  const t = useT();
  const s = state.student;
  const [f, setF] = useState<Form>({
    fatherName: s.fatherName,
    gender: s.gender,
    dob: s.dob,
    programme: s.programme,
    majorSubject: s.majorSubject,
    session: s.session,
    semester: s.semester,
    mobile: s.mobile,
    email: s.email,
    username: s.username,
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = k === "mobile" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value;
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: "" }));
  };

  const today = new Date();
  const maxDob = `${today.getFullYear() - 14}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const minDob = `${today.getFullYear() - 60}-01-01`;

  const validate = () => {
    const e: Record<string, string> = {};
    const req = t("reg.v.required");
    if (f.fatherName.trim().length < 2) e.fatherName = req;
    if (!f.gender) e.gender = req;
    if (!f.dob || f.dob > maxDob || f.dob < minDob) e.dob = t("reg.v.dob");
    if (!f.programme) e.programme = req;
    if (f.majorSubject.trim().length < 2) e.majorSubject = req;
    if (!f.session) e.session = req;
    if (!f.semester) e.semester = req;
    if (!/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = t("reg.v.mobile");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = t("reg.v.email");
    if (!/^[a-zA-Z0-9._-]{4,40}$/.test(f.username.trim())) e.username = t("reg.v.username");
    const needPw = !s.hasAccount || f.password.length > 0;
    if (needPw && f.password.length < 8) e.password = t("reg.v.password");
    if (needPw && f.password !== f.confirmPassword) e.confirmPassword = t("reg.v.confirm");
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setError(t("reg.v.fix"));
      const first = Object.keys(e)[0];
      document.getElementById(`d-${first}`)?.focus();
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ state: RegState }>("/api/register/details", {
        body: { ...f, username: f.username.trim(), email: f.email.trim(), password: f.password || undefined, confirmPassword: f.confirmPassword || undefined },
      });
      onSaved(res.state);
    } catch (err) {
      setLoading(false);
      if (onError(err)) return;
      const fe = errFields(err);
      const msg = errText(err, t);
      if (fe.username || fe.email) setErrors({ ...(fe.username ? { username: msg } : {}), ...(fe.email ? { email: msg } : {}) });
      else setErrors(fe);
      setError(msg);
    }
  };

  const opt = (list: { value: string; label: string }[]) =>
    list.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ));

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <div className="border-b border-slate-100 px-5 py-5 sm:px-8">
          <h2 className="text-xl font-bold text-slate-900">{t("reg.details.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("reg.details.desc")}</p>
        </div>
        <div className="space-y-6 px-5 py-6 sm:px-8">
          {error && <Alert tone="error">{error}</Alert>}
          <Section icon={<User />} title={t("reg.details.personal")}>
            <Field label={t("reg.f.name")} htmlFor="d-name" hint={t("reg.f.nameHint")} className="sm:col-span-2">
              <Input id="d-name" value={s.name} readOnly aria-readonly leading={<Lock className="size-4" />} />
            </Field>
            <Field label={t("reg.f.fatherName")} htmlFor="d-fatherName" error={errors.fatherName} required>
              <Input id="d-fatherName" value={f.fatherName} onChange={set("fatherName")} maxLength={100} autoComplete="off" invalid={Boolean(errors.fatherName)} />
            </Field>
            <Field label={t("reg.f.dob")} htmlFor="d-dob" error={errors.dob} required>
              <Input id="d-dob" type="date" value={f.dob} onChange={set("dob")} min={minDob} max={maxDob} invalid={Boolean(errors.dob)} />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("reg.f.gender")}
                <span className="ml-0.5 text-rose-500">*</span>
              </legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup">
                {GENDERS.map((g) => (
                  <label
                    key={g}
                    className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 ${
                      f.gender === g ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <input
                      id={g === "MALE" ? "d-gender" : undefined}
                      type="radio"
                      name="gender"
                      value={g}
                      checked={f.gender === g}
                      onChange={set("gender")}
                      className="sr-only"
                    />
                    {t(`reg.gender.${g}`)}
                  </label>
                ))}
              </div>
              {errors.gender && <p className="mt-1 text-xs font-medium text-rose-600">{errors.gender}</p>}
            </fieldset>
          </Section>

          <Section icon={<GraduationCap />} title={t("reg.details.academic")}>
            <Field label={t("reg.f.regNo")} htmlFor="d-reg">
              <Input id="d-reg" value={s.registrationNumber} readOnly className="font-mono" />
            </Field>
            <Field label={t("reg.f.college")} htmlFor="d-college">
              <Input id="d-college" value={s.college.name} readOnly />
            </Field>
            <Field label={t("reg.f.programme")} htmlFor="d-programme" error={errors.programme} required>
              <Select id="d-programme" value={f.programme} onChange={set("programme")} invalid={Boolean(errors.programme)}>
                <option value="">{t("reg.f.select")}</option>
                {opt(state.options.programmes)}
              </Select>
            </Field>
            <Field label={t("reg.f.majorSubject")} htmlFor="d-majorSubject" error={errors.majorSubject} required>
              <Input
                id="d-majorSubject"
                value={f.majorSubject}
                onChange={set("majorSubject")}
                maxLength={100}
                placeholder={t("reg.f.majorPlaceholder")}
                invalid={Boolean(errors.majorSubject)}
              />
            </Field>
            <Field label={t("reg.f.session")} htmlFor="d-session" error={errors.session} required>
              <Select id="d-session" value={f.session} onChange={set("session")} invalid={Boolean(errors.session)}>
                <option value="">{t("reg.f.select")}</option>
                {opt(state.options.sessions)}
              </Select>
            </Field>
            <Field label={t("reg.f.semester")} htmlFor="d-semester" error={errors.semester} required>
              <Select id="d-semester" value={f.semester} onChange={set("semester")} invalid={Boolean(errors.semester)}>
                <option value="">{t("reg.f.select")}</option>
                {opt(state.options.semesters)}
              </Select>
            </Field>
          </Section>

          <Section icon={<AtSign />} title={t("reg.details.account")} desc={t("reg.details.accountDesc")}>
            <Field label={t("reg.f.mobile")} htmlFor="d-mobile" error={errors.mobile} hint={t("reg.f.mobileHint")} required>
              <Input
                id="d-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={f.mobile}
                onChange={set("mobile")}
                placeholder="98XXXXXXXX"
                invalid={Boolean(errors.mobile)}
                leading={<Phone className="size-4" />}
              />
            </Field>
            <Field label={t("reg.f.email")} htmlFor="d-email" error={errors.email} hint={t("reg.f.emailHint")} required>
              <Input
                id="d-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={f.email}
                onChange={set("email")}
                maxLength={120}
                invalid={Boolean(errors.email)}
                leading={<Mail className="size-4" />}
              />
            </Field>
            <Field label={t("reg.f.username")} htmlFor="d-username" error={errors.username} hint={t("reg.f.usernameHint")} required className="sm:col-span-2">
              <Input
                id="d-username"
                value={f.username}
                onChange={set("username")}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={40}
                invalid={Boolean(errors.username)}
                leading={<User className="size-4" />}
              />
            </Field>
            <Field
              label={s.hasAccount ? t("reg.f.passwordKeep") : t("reg.f.password")}
              htmlFor="d-password"
              error={errors.password}
              hint={s.hasAccount ? t("reg.f.passwordKeepHint") : t("reg.f.passwordHint")}
              required={!s.hasAccount}
            >
              <div className="relative">
                <Input
                  id="d-password"
                  type={showPw ? "text" : "password"}
                  value={f.password}
                  onChange={set("password")}
                  autoComplete="new-password"
                  maxLength={128}
                  className="pr-10"
                  invalid={Boolean(errors.password)}
                  leading={<KeyRound className="size-4" />}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
                  aria-label={showPw ? t("reg.f.hidePassword") : t("reg.f.showPassword")}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Field label={t("reg.f.confirmPassword")} htmlFor="d-confirmPassword" error={errors.confirmPassword} required={!s.hasAccount}>
              <Input
                id="d-confirmPassword"
                type={showPw ? "text" : "password"}
                value={f.confirmPassword}
                onChange={set("confirmPassword")}
                autoComplete="new-password"
                maxLength={128}
                invalid={Boolean(errors.confirmPassword)}
                leading={<KeyRound className="size-4" />}
              />
            </Field>
          </Section>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          {onBack ? (
            <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="size-4" />}>
              {t("reg.back")}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" loading={loading} className="w-full sm:w-auto" icon={!loading ? <ArrowRight className="size-4" /> : undefined}>
            {t("reg.saveContinue")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
