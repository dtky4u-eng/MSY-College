"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/** Change the signed-in user's own password via POST /api/auth/change-password. */
export function ChangePasswordForm() {
  const [v, setV] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, loading, fields } = useAction();
  const err = { ...errors, ...fields };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ve: Record<string, string> = {};
    if (!v.currentPassword) ve.currentPassword = "Enter your current password";
    if (v.newPassword.length < 8) ve.newPassword = "Password must be at least 8 characters";
    else if (v.newPassword === v.currentPassword) ve.newPassword = "Choose a password different from the current one";
    if (v.confirmPassword !== v.newPassword) ve.confirmPassword = "Passwords do not match";
    setErrors(ve);
    if (Object.keys(ve).length) return;
    const res = await run(() => api("/api/auth/change-password", { body: v }), { success: "Password changed", successDescription: "Other sessions have been signed out." });
    if (res) setV({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  const input = (k: keyof typeof v, label: string, auto: string, hint?: string) => (
    <Field label={label} htmlFor={`pw-${k}`} error={err[k]} hint={hint} required>
      <Input id={`pw-${k}`} type="password" autoComplete={auto} value={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} invalid={Boolean(err[k])} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {input("currentPassword", "Current password", "current-password")}
      {input("newPassword", "New password", "new-password", "At least 8 characters")}
      {input("confirmPassword", "Confirm new password", "new-password")}
      <Button type="submit" className="w-full" loading={loading} icon={<KeyRound className="size-4" />}>
        Update password
      </Button>
    </form>
  );
}
