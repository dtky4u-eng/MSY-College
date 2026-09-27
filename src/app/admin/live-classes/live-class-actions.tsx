"use client";
import { useEffect, useState } from "react";
import { Ban, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/page";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { formatDateTime, formatTime } from "@/lib/format";
import { LiveClassForm, type DomainTree, type LiveClassValue } from "./live-class-form";

interface Attendee {
  id: string;
  name: string;
  regNo: string;
  college: string;
  joinedAt: string;
  leftAt: string | null;
  minutes: number | null;
}

export function LiveClassActions({ value, domains, canEdit, canCancel, attendance }: { value: LiveClassValue; domains: DomainTree[]; canEdit: boolean; canCancel: boolean; attendance: number }) {
  const [mode, setMode] = useState<"none" | "edit" | "cancel" | "attendees">("none");
  const cancel = useAction();
  return (
    <div className="flex justify-end gap-1.5">
      <Button size="xs" variant="outline" icon={<Users className="size-3.5" />} onClick={() => setMode("attendees")} aria-label={`View ${attendance} attendee(s)`}>
        {attendance}
      </Button>
      {canEdit && (
        <Button size="xs" variant="outline" icon={<Pencil className="size-3.5" />} onClick={() => setMode("edit")}>
          Edit
        </Button>
      )}
      {canCancel && (
        <Button size="xs" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" icon={<Ban className="size-3.5" />} onClick={() => setMode("cancel")}>
          Cancel
        </Button>
      )}
      {mode === "edit" && <LiveClassForm domains={domains} value={value} onClose={() => setMode("none")} />}
      <ConfirmDialog
        open={mode === "cancel"}
        onClose={() => setMode("none")}
        tone="danger"
        confirmLabel="Cancel class"
        loading={cancel.loading}
        title="Cancel this live class?"
        description={`${value.title} · ${formatDateTime(value.startsAt)} IST`}
        onConfirm={async () => {
          const ok = await cancel.run(() => api(`/api/admin/live-classes/${value.id}/cancel`, { method: "POST" }), { success: "Live class cancelled", successDescription: "Students of the domain have been notified.", refresh: true });
          if (ok) setMode("none");
        }}
      >
        <p className="text-sm text-slate-600">Students will see the class as cancelled and receive a notification. This cannot be reversed; schedule a new class if needed.</p>
      </ConfirmDialog>
      {mode === "attendees" && <AttendeesModal value={value} onClose={() => setMode("none")} />}
    </div>
  );
}

function AttendeesModal({ value, onClose }: { value: LiveClassValue; onClose: () => void }) {
  const [data, setData] = useState<{ eligible: number; attendees: Attendee[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ eligible: number; attendees: Attendee[] }>(`/api/admin/live-classes/${value.id}/attendance`)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load attendees"));
  }, [value.id]);
  return (
    <Modal open onClose={onClose} size="xl" title="Attendance" description={`${value.title} · ${formatDateTime(value.startsAt)} IST`}>
      {err ? (
        <Alert tone="error">{err}</Alert>
      ) : !data ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600">
            <b className="text-slate-900">{data.attendees.length}</b> of {data.eligible} eligible student(s) joined
            {data.eligible ? ` (${Math.round((data.attendees.length / data.eligible) * 100)}%)` : ""}.
          </p>
          <div className="-mx-5">
            <Table>
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>College</TH>
                  <TH>Joined</TH>
                  <TH>Left</TH>
                  <TH className="text-right">Minutes</TH>
                </TR>
              </THead>
              <TBody>
                {data.attendees.length === 0 && <EmptyRow colSpan={5}>No students have joined this class.</EmptyRow>}
                {data.attendees.map((a) => (
                  <TR key={a.id}>
                    <TD>
                      <p className="font-medium text-slate-900">{a.name}</p>
                      <p className="text-xs text-slate-500">{a.regNo}</p>
                    </TD>
                    <TD className="max-w-[200px] truncate">{a.college}</TD>
                    <TD className="whitespace-nowrap">{formatTime(a.joinedAt)}</TD>
                    <TD className="whitespace-nowrap">{a.leftAt ? formatTime(a.leftAt) : <span className="text-slate-400">Not recorded</span>}</TD>
                    <TD className="text-right tabular-nums">{a.minutes ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </>
      )}
    </Modal>
  );
}
