"use client";
import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";

/** Set a new login password for a registered student (min 8 characters). Signs the student out everywhere. */
export function PasswordManager({ studentId, username }: { studentId: string; username: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [local, setLocal] = useState<Record<string, string>>({});
  const { run, loading, fields, setFields } = useAction();
  const err = { ...fields, ...local };

  const reset = () => {
    setPw("");
    setConfirm("");
    setShow(false);
    setLocal({});
    setFields({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (pw.length < 8) v.password = "Password must be at least 8 characters";
    else if (pw.length > 128) v.password = "Password must be 128 characters or fewer";
    if (!confirm) v.confirmPassword = "Re-enter the new password";
    else if (confirm !== pw) v.confirmPassword = "Passwords do not match";
    setLocal(v);
    if (Object.keys(v).length) return;
    const res = await run(() => api(`/api/admin/students/${studentId}/password`, { body: { password: pw, confirmPassword: confirm } }), {
      success: "Password changed",
      successDescription: "The student has been signed out of all devices.",
      refresh: true,
    });
    if (res) {
      setOpen(false);
      reset();
    }
  };

  const clear = (k: string) => {
    setLocal((s) => ({ ...s, [k]: "" }));
    setFields((s) => ({ ...s, [k]: "" }));
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        icon={<KeyRound className="size-4" />}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Change password
      </Button>
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        size="sm"
        title="Change password"
        description={`Set a new password for @${username}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="student-password-form" loading={loading}>
              Change password
            </Button>
          </>
        }
      >
        <form id="student-password-form" onSubmit={submit} noValidate className="space-y-4">
          <Field label="New password" htmlFor="pw-new" required error={err.password} hint="At least 8 characters">
            <div className="relative">
              <Input
                id="pw-new"
                type={show ? "text" : "password"}
                value={pw}
                onChange={(e) => {
                  setPw(e.target.value);
                  clear("password");
                }}
                invalid={Boolean(err.password)}
                autoComplete="new-password"
                maxLength={128}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((x) => !x)}
                className="absolute inset-y-0 right-2 flex items-center px-1 text-slate-400 hover:text-slate-600"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirm new password" htmlFor="pw-confirm" required error={err.confirmPassword}>
            <Input
              id="pw-confirm"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                clear("confirmPassword");
              }}
              invalid={Boolean(err.confirmPassword)}
              autoComplete="new-password"
              maxLength={128}
            />
          </Field>
          <Alert tone="warning">The student is signed out of every device and must use the new password. Share it through a secure channel.</Alert>
        </form>
      </Modal>
    </>
  );
}
