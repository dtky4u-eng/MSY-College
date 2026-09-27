"use client";
import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";

/** Audited unlock (for corrections) / re-lock of a confirmed registration. A reason is required. */
export function RegistrationManager({ studentId, locked, paid, canLock }: { studentId: string; locked: boolean; paid: boolean; canLock: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [local, setLocal] = useState<Record<string, string>>({});
  const { run, loading, fields, setFields } = useAction();
  const err = { ...fields, ...local };
  const action = locked ? "UNLOCK" : "LOCK";

  if (!locked && !canLock) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = reason.trim();
    const v: Record<string, string> = {};
    if (r.length < 10) v.reason = "Enter a reason of at least 10 characters";
    else if (r.length > 500) v.reason = "Reason must be 500 characters or fewer";
    setLocal(v);
    if (Object.keys(v).length) return;
    const res = await run(() => api(`/api/admin/students/${studentId}/registration`, { body: { action, reason: r } }), {
      success: locked ? "Registration unlocked" : "Registration locked",
      refresh: true,
    });
    if (res) setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        icon={locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
        onClick={() => {
          setReason("");
          setLocal({});
          setFields({});
          setOpen(true);
        }}
      >
        {locked ? "Unlock registration" : "Lock registration"}
      </Button>
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        size="sm"
        title={locked ? "Unlock registration" : "Lock registration"}
        description="This action is recorded in the audit log with your reason."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="student-registration-form" variant={locked ? "primary" : "danger"} loading={loading}>
              {locked ? "Unlock" : "Lock"}
            </Button>
          </>
        }
      >
        <form id="student-registration-form" onSubmit={submit} noValidate className="space-y-4">
          {locked ? (
            <Alert tone="info">
              {paid
                ? "The student has paid, so their progress is kept. They can correct their registration details."
                : "The student returns to the personal details step and must review and confirm their registration again."}
            </Alert>
          ) : (
            <Alert tone="warning">The student will no longer be able to change their registration details.</Alert>
          )}
          <Field label="Reason" htmlFor="rg-reason" required error={err.reason} hint={`${reason.trim().length}/500`}>
            <Textarea
              id="rg-reason"
              rows={3}
              value={reason}
              maxLength={500}
              invalid={Boolean(err.reason)}
              placeholder={locked ? "e.g. Student reported a spelling mistake in their father's name" : "e.g. Corrections completed and verified"}
              onChange={(e) => {
                setReason(e.target.value);
                setLocal({});
                setFields({});
              }}
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
