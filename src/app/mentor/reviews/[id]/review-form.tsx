"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/page";
import { ConfirmDialog } from "@/components/ui/modal";

export function ReviewForm({ id, maxMarks, initialFeedback, initialMarks, status }: { id: string; maxMarks: number | null; initialFeedback: string; initialMarks: number | null; status: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState(initialFeedback);
  const [marks, setMarks] = useState(initialMarks !== null ? String(initialMarks) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<"APPROVED" | "RESUBMIT" | null>(null);
  const { run, loading, fields } = useAction();
  const err = { ...errors, ...fields };

  const check = (decision: "APPROVED" | "RESUBMIT") => {
    const e: Record<string, string> = {};
    if (decision === "RESUBMIT" && feedback.trim().length < 5) e.feedback = "Explain what the student should change (at least 5 characters)";
    if (maxMarks !== null && (decision === "APPROVED" || marks !== "")) {
      const n = Number(marks);
      if (marks === "" || !Number.isInteger(n) || n < 0 || n > maxMarks) e.marks = `Enter whole marks between 0 and ${maxMarks}`;
    }
    setErrors(e);
    if (!Object.keys(e).length) setConfirm(decision);
  };

  const submit = async () => {
    if (!confirm) return;
    const res = await run(
      () => api(`/api/mentor/reviews/${id}`, { body: { decision: confirm, feedback: feedback.trim() || null, marks: maxMarks !== null && marks !== "" ? Number(marks) : null } }),
      { success: confirm === "APPROVED" ? "Submission approved" : "Resubmission requested", successDescription: "The student has been notified." },
    );
    setConfirm(null);
    if (res) {
      router.push("/mentor/reviews");
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      {status === "RESUBMIT" && <Alert tone="warning">Resubmission was requested. You can still update your review until the student resubmits.</Alert>}
      <Field label="Comments / feedback" htmlFor="rv-feedback" error={err.feedback} hint="Required when requesting a resubmission">
        <Textarea id="rv-feedback" rows={6} maxLength={2000} value={feedback} onChange={(e) => setFeedback(e.target.value)} invalid={Boolean(err.feedback)} />
      </Field>
      {maxMarks !== null && (
        <Field label={`Marks (out of ${maxMarks})`} htmlFor="rv-marks" error={err.marks} required hint="Required to approve an assignment">
          <Input id="rv-marks" type="number" min={0} max={maxMarks} step={1} value={marks} onChange={(e) => setMarks(e.target.value)} invalid={Boolean(err.marks)} />
        </Field>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="text-rose-700" icon={<RotateCcw className="size-4" />} onClick={() => check("RESUBMIT")} disabled={loading}>
          Request resubmission
        </Button>
        <Button variant="success" icon={<CheckCircle2 className="size-4" />} onClick={() => check("APPROVED")} disabled={loading}>
          Approve
        </Button>
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={submit}
        loading={loading}
        tone={confirm === "APPROVED" ? "success" : "danger"}
        title={confirm === "APPROVED" ? "Approve this submission?" : "Request resubmission?"}
        description={confirm === "APPROVED" ? "Approved submissions are locked and cannot be reviewed again." : "The student will be asked to upload a revised version."}
        confirmLabel={confirm === "APPROVED" ? "Approve" : "Request resubmission"}
      />
    </div>
  );
}
