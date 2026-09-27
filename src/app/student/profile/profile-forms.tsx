"use client";
import { useRef, useState } from "react";
import { Camera, KeyRound, Loader2, Mail, Phone, Save } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { LIMITS } from "@/lib/constants";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useT } from "@/components/i18n";
import { ACCEPT } from "@/components/student/utils";

const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** G-5: real photo upload (JPG/PNG/WEBP ≤ 2 MB). */
export function PhotoUpload({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const t = useT();
  const { run, loading } = useAction();
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const pick = async (f: File | undefined) => {
    if (ref.current) ref.current.value = "";
    if (!f) return;
    setError(null);
    if (!IMG_TYPES.includes(f.type)) return setError(t("profile.err.photoType"));
    if (f.size > LIMITS.imageBytes) return setError(t("profile.err.photoSize"));
    const local = URL.createObjectURL(f);
    setPreview(local);
    const form = new FormData();
    form.set("photo", f);
    const r = await run(() => api("/api/student/profile/photo", { form }), { success: t("profile.photoUpdated"), refresh: true });
    if (r === undefined) setPreview(null);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <Avatar name={name} src={preview ?? photoUrl} size={112} className="shadow-card" />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={loading}
          className="absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop ring-2 ring-white hover:bg-brand-700 disabled:opacity-70"
          aria-label={t("profile.changePhoto")}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        </button>
      </div>
      <input ref={ref} type="file" accept={ACCEPT.image} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <p className="mt-2 text-xs text-slate-500">{t("profile.photoHint")}</p>
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

export function ContactForm({ initialMobile, initialEmail }: { initialMobile: string; initialEmail: string }) {
  const t = useT();
  const { run, loading, fields } = useAction();
  const [mobile, setMobile] = useState(initialMobile);
  const [email, setEmail] = useState(initialEmail);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = mobile.trim() !== initialMobile || email.trim().toLowerCase() !== initialEmail.toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^\+?\d{10,15}$/.test(mobile.trim())) errs.mobile = t("profile.err.mobile");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || email.trim().length > 160) errs.email = t("profile.err.email");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await run(() => api("/api/student/profile", { method: "PATCH", body: { mobile: mobile.trim(), email: email.trim() } }), { success: t("profile.saved"), refresh: true });
  };

  const err = { ...fields, ...errors };
  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-5">
      <Field label={t("profile.mobile")} htmlFor="pf-mobile" required error={err.mobile} hint={t("profile.mobileHint")}>
        <Input id="pf-mobile" type="tel" inputMode="tel" autoComplete="tel" maxLength={16} leading={<Phone className="size-4" />} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^\d+]/g, ""))} invalid={Boolean(err.mobile)} disabled={loading} />
      </Field>
      <Field label={t("profile.email")} htmlFor="pf-email" required error={err.email}>
        <Input id="pf-email" type="email" autoComplete="email" maxLength={160} leading={<Mail className="size-4" />} value={email} onChange={(e) => setEmail(e.target.value)} invalid={Boolean(err.email)} disabled={loading} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" icon={<Save className="size-4" />} loading={loading} disabled={!dirty}>
          {t("action.save")}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const t = useT();
  const { run, loading, fields } = useAction();
  const [v, setV] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!v.currentPassword) errs.currentPassword = t("pw.err.current");
    if (v.newPassword.length < 8) errs.newPassword = t("pw.err.min");
    else if (v.newPassword === v.currentPassword) errs.newPassword = t("pw.err.same");
    if (v.confirmPassword !== v.newPassword) errs.confirmPassword = t("pw.err.match");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const r = await run(() => api("/api/auth/change-password", { body: v }), { success: t("pw.changed"), successDescription: t("pw.changedDesc") });
    if (r !== undefined) setV({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  const err = { ...fields, ...errors };
  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-5">
      <Field label={t("pw.current")} htmlFor="pw-cur" required error={err.currentPassword}>
        <Input id="pw-cur" type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} invalid={Boolean(err.currentPassword)} disabled={loading} />
      </Field>
      <Field label={t("pw.new")} htmlFor="pw-new" required error={err.newPassword} hint={t("pw.hint")}>
        <Input id="pw-new" type="password" autoComplete="new-password" maxLength={128} value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} invalid={Boolean(err.newPassword)} disabled={loading} />
      </Field>
      <Field label={t("pw.confirm")} htmlFor="pw-confirm" required error={err.confirmPassword}>
        <Input id="pw-confirm" type="password" autoComplete="new-password" maxLength={128} value={v.confirmPassword} onChange={(e) => setV({ ...v, confirmPassword: e.target.value })} invalid={Boolean(err.confirmPassword)} disabled={loading} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" icon={<KeyRound className="size-4" />} loading={loading}>
          {t("pw.submit")}
        </Button>
      </div>
    </form>
  );
}
