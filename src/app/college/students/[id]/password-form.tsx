"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";

export function StudentPasswordForm({ studentId }: { studentId: string }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ask, setAsk] = useState(false);
  const { run, loading, fields } = useAction();
  const err = { ...fields, ...errors };

  const check = () => {
    const e: Record<string, string> = {};
    if (pw.length < 8) e.newPassword = "Password must be at least 8 characters";
    else if (pw.length > 128) e.newPassword = "Password is too long";
    if (confirm !== pw) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    const res = await run(() => api(`/api/college/students/${studentId}/password`, { body: { newPassword: pw, confirmPassword: confirm } }), {
      success: "Password changed",
      successDescription: "The student has been signed out of all devices.",
    });
    setAsk(false);
    if (res) {
      setPw("");
      setConfirm("");
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (check()) setAsk(true);
      }}
      noValidate
    >
      <Field label="New password" htmlFor="sp-new" error={err.newPassword} hint="At least 8 characters" required>
        <Input id="sp-new" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} invalid={Boolean(err.newPassword)} />
      </Field>
      <Field label="Confirm password" htmlFor="sp-confirm" error={err.confirmPassword} required>
        <Input id="sp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={Boolean(err.confirmPassword)} />
      </Field>
      <Button type="submit" className="w-full" icon={<KeyRound className="size-4" />} disabled={!pw || !confirm}>
        Change password
      </Button>
      <ConfirmDialog
        open={ask}
        onClose={() => setAsk(false)}
        onConfirm={submit}
        loading={loading}
        title="Change student password?"
        description="The student will be signed out everywhere and must use the new password to sign in. Share it with the student securely."
        confirmLabel="Change password"
      />
    </form>
  );
}
