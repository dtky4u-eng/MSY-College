"use client";
import { useState } from "react";
import { Lock, Save } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CardBody, CardFooter } from "@/components/ui/card";

type Values = {
  code: string;
  name: string;
  university: string;
  principal: string;
  coordinator: string;
  mobile: string;
  email: string;
  state: string;
  district: string;
  pincode: string;
  address: string;
};

function validateValues(v: Values): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.name.trim().length < 3) e.name = "College name must be at least 3 characters";
  if (v.university.trim().length < 2) e.university = "Enter the affiliating university";
  if (!/^[6-9]\d{9}$/.test(v.mobile.trim())) e.mobile = "Enter a valid 10-digit mobile number";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) e.email = "Enter a valid email address";
  if (v.pincode.trim() && !/^\d{6}$/.test(v.pincode.trim())) e.pincode = "Pincode must be 6 digits";
  return e;
}

export function ProfileForm({ initial }: { initial: Values }) {
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, loading, fields } = useAction();
  const err = { ...errors, ...fields };
  const dirty = (Object.keys(initial) as (keyof Values)[]).some((k) => initial[k] !== v[k]);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ve = validateValues(v);
    setErrors(ve);
    if (Object.keys(ve).length) return;
    const { code: _code, ...body } = v;
    void _code;
    await run(() => api("/api/college/profile", { method: "PATCH", body }), { success: "Profile updated", refresh: true });
  };

  const text = (k: keyof Values, label: string, opts: { required?: boolean; type?: string; inputMode?: "numeric" | "email" | "tel"; maxLength?: number; placeholder?: string; autoComplete?: string } = {}) => (
    <Field label={label} htmlFor={`cp-${k}`} error={err[k]} required={opts.required}>
      <Input
        id={`cp-${k}`}
        type={opts.type ?? "text"}
        value={v[k]}
        onChange={set(k)}
        inputMode={opts.inputMode}
        maxLength={opts.maxLength}
        placeholder={opts.placeholder}
        autoComplete={opts.autoComplete}
        invalid={Boolean(err[k])}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Field label="College code" htmlFor="cp-code" hint="The college code is assigned by MSY College and cannot be changed" className="sm:col-span-2">
          <Input id="cp-code" value={v.code} readOnly disabled leading={<Lock className="size-4" />} className="font-mono" />
        </Field>
        <div className="sm:col-span-2">{text("name", "College name", { required: true, maxLength: 200 })}</div>
        <div className="sm:col-span-2">{text("university", "University", { required: true, maxLength: 200 })}</div>
        {text("principal", "Principal", { maxLength: 120 })}
        {text("coordinator", "Internship coordinator", { maxLength: 120 })}
        {text("mobile", "Mobile", { required: true, type: "tel", inputMode: "numeric", maxLength: 10, placeholder: "10-digit mobile", autoComplete: "tel" })}
        {text("email", "Email", { required: true, type: "email", inputMode: "email", maxLength: 160, autoComplete: "email" })}
        {text("state", "State", { maxLength: 80 })}
        {text("district", "District", { maxLength: 80 })}
        {text("pincode", "Pincode", { inputMode: "numeric", maxLength: 6, placeholder: "6 digits" })}
        <Field label="Address" htmlFor="cp-address" error={err.address} className="sm:col-span-2">
          <Textarea id="cp-address" rows={3} value={v.address} onChange={set("address")} maxLength={500} invalid={Boolean(err.address)} />
        </Field>
      </CardBody>
      <CardFooter>
        <Button type="button" variant="ghost" disabled={!dirty || loading} onClick={() => { setV(initial); setErrors({}); }}>
          Reset
        </Button>
        <Button type="submit" loading={loading} disabled={!dirty} icon={<Save className="size-4" />}>
          Save changes
        </Button>
      </CardFooter>
    </form>
  );
}
