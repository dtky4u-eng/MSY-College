"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";

const OPTIONS = [
  { value: "PENDING", label: "Pending", help: "Registered but the internship has not been activated." },
  { value: "ACTIVE", label: "Active", help: "Internship access enabled (requires a paid fee)." },
  { value: "COMPLETED", label: "Completed", help: "Internship finished; attendance is locked." },
  { value: "BLOCKED", label: "Blocked", help: "Access suspended. The student is signed out and sees the reason." },
] as const;

/** Change lifecycle status; blocking requires a reason (FR-ADM-6, NFR-5). */
export function StatusManager({
  studentId,
  status,
  blockedReason,
  paid,
  hasAccount,
}: {
  studentId: string;
  status: string;
  blockedReason: string | null;
  paid: boolean;
  hasAccount: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState(status);
  const [reason, setReason] = useState("");
  const [local, setLocal] = useState<Record<string, string>>({});
  const { run, loading, fields, setFields } = useAction();
  const err = { ...fields, ...local };

  const openModal = () => {
    const initial = status === "BLOCKED" ? (paid ? "ACTIVE" : "PENDING") : status;
    setNext(initial);
    setReason("");
    setLocal({});
    setFields({});
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    const updatingReason = next === "BLOCKED" && status === "BLOCKED";
    if (next === status && !updatingReason) v.status = "Choose a different status";
    if (next === "ACTIVE" && !paid) v.status = "Only paid students can be made active";
    if (next === "BLOCKED" && reason.trim().length < 5) v.reason = "Enter the reason for blocking (at least 5 characters)";
    if (reason.length > 500) v.reason = "Reason must be 500 characters or fewer";
    setLocal(v);
    if (Object.keys(v).length) return;
    const res = await run(() => api(`/api/admin/students/${studentId}/status`, { body: { status: next, reason: reason.trim() } }), {
      success: next === "BLOCKED" ? (status === "BLOCKED" ? "Block reason updated" : "Student blocked") : "Status updated",
      successDescription: next === "BLOCKED" && status !== "BLOCKED" && hasAccount ? "The student has been signed out of all devices." : undefined,
      refresh: true,
    });
    if (res) setOpen(false);
  };

  const selected = OPTIONS.find((o) => o.value === next);
  return (
    <>
      <Button variant={status === "BLOCKED" ? "success" : "outline"} size="sm" icon={<ShieldCheck className="size-4" />} onClick={openModal}>
        {status === "BLOCKED" ? "Unblock / change" : "Change status"}
      </Button>
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        size="md"
        title="Change student status"
        description="Status changes are recorded in the audit log."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="student-status-form" variant={next === "BLOCKED" ? "danger" : "primary"} loading={loading}>
              {next === "BLOCKED" ? (status === "BLOCKED" ? "Update reason" : "Block student") : "Save status"}
            </Button>
          </>
        }
      >
        <form id="student-status-form" onSubmit={submit} noValidate className="space-y-4">
          <Field label="New status" htmlFor="st-status" required error={err.status} hint={selected?.help}>
            <Select
              id="st-status"
              value={next}
              invalid={Boolean(err.status)}
              onChange={(e) => {
                setNext(e.target.value);
                setLocal({});
                setFields({});
              }}
            >
              {OPTIONS.map((o) => (
                <option key={o.value} value={o.value} disabled={o.value === "ACTIVE" && !paid && status !== "ACTIVE"}>
                  {o.label}
                  {o.value === status ? " (current)" : ""}
                  {o.value === "ACTIVE" && !paid ? " — fee not paid" : ""}
                </option>
              ))}
            </Select>
          </Field>
          {next === "BLOCKED" && (
            <Field label="Reason for blocking" htmlFor="st-reason" required error={err.reason} hint={`${reason.trim().length}/500 · shown to the student`}>
              <Textarea
                id="st-reason"
                rows={3}
                value={reason}
                maxLength={500}
                invalid={Boolean(err.reason)}
                placeholder={blockedReason ?? "e.g. Fee payment disputed with the bank — access paused pending review"}
                onChange={(e) => {
                  setReason(e.target.value);
                  setLocal((s) => ({ ...s, reason: "" }));
                  setFields((s) => ({ ...s, reason: "" }));
                }}
              />
            </Field>
          )}
          {next !== "BLOCKED" && next !== status && (
            <Field label="Note (optional)" htmlFor="st-note" hint="Saved in the audit log">
              <Textarea id="st-note" rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
          {next === "BLOCKED" && status !== "BLOCKED" && hasAccount && (
            <Alert tone="warning">The student will be signed out of every device immediately.</Alert>
          )}
          {status === "BLOCKED" && next !== "BLOCKED" && <Alert tone="info">The blocked reason will be cleared and the student regains access.</Alert>}
          {next === "COMPLETED" && status !== "COMPLETED" && (
            <Alert tone="info">This only changes the status. Use Bulk Automation to publish results and issue certificates.</Alert>
          )}
        </form>
      </Modal>
    </>
  );
}
