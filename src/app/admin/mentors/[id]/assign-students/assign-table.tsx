"use client";
import { useState } from "react";
import Link from "next/link";
import { UserMinus, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { formatDate } from "@/lib/format";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page";
import { ConfirmDialog } from "@/components/ui/modal";
import { cn } from "@/components/ui/cn";

export interface AssignRow {
  id: string;
  name: string;
  registrationNumber: string;
  portalRegNo: string | null;
  college: string;
  session: string | null;
  status: string;
  internshipStart: string | null;
  mentor: { id: string; name: string; employeeId: string } | null;
}

export function AssignTable({ mentorId, mentorActive, rows, view }: { mentorId: string; mentorActive: boolean; rows: AssignRow[]; view: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<"assign" | "remove" | null>(null);
  const { run, loading } = useAction();

  const sel = rows.filter((r) => selected.has(r.id));
  const assignable = sel.filter((r) => r.mentor?.id !== mentorId);
  const removable = sel.filter((r) => r.mentor?.id === mentorId);
  const reassigning = assignable.filter((r) => r.mentor);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const doAction = async (action: "assign" | "remove") => {
    const ids = (action === "assign" ? assignable : removable).map((r) => r.id);
    const res = await run(() => api<{ assigned?: number; removed?: number; skipped: number }>(`/api/admin/mentors/${mentorId}/students`, { body: { action, studentIds: ids } }), {
      refresh: true,
      success: action === "assign" ? `${ids.length} student${ids.length === 1 ? "" : "s"} assigned` : `${ids.length} student${ids.length === 1 ? "" : "s"} removed`,
      successDescription: action === "assign" ? "Students have been notified about their mentor." : undefined,
    });
    if (res) setSelected(new Set());
    setConfirm(null);
  };

  if (!rows.length) {
    return (
      <EmptyState
        icon={<Users />}
        title={view === "unassigned" ? "Every paid student in this domain has a mentor" : "No students found"}
        description={view === "unassigned" ? "New paid students will appear here once their payment is verified." : "Try a different tab or filter."}
      />
    );
  }

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-2.5 transition-colors", sel.length ? "bg-brand-50/60" : "bg-white")}>
        <span className="text-sm text-slate-600">{sel.length ? `${sel.length} selected` : "Select students to assign or remove"}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" icon={<UserPlus className="size-4" />} disabled={!assignable.length || !mentorActive} loading={loading && confirm === "assign"} onClick={() => (reassigning.length ? setConfirm("assign") : doAction("assign"))}>
            Assign{assignable.length ? ` (${assignable.length})` : ""}
          </Button>
          <Button size="sm" variant="outline" icon={<UserMinus className="size-4" />} disabled={!removable.length} onClick={() => setConfirm("remove")}>
            Remove{removable.length ? ` (${removable.length})` : ""}
          </Button>
        </div>
      </div>
      <Table>
        <THead>
          <tr>
            <TH className="w-10">
              <input type="checkbox" className="size-4 accent-brand-600" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all students on this page" />
            </TH>
            <TH>Student</TH>
            <TH>College</TH>
            <TH>Session</TH>
            <TH>Status</TH>
            <TH>Start date</TH>
            <TH>Current mentor</TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id} className={cn(selected.has(r.id) && "bg-brand-50/40")}>
              <TD>
                <input type="checkbox" className="size-4 accent-brand-600" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
              </TD>
              <TD>
                <Link href={`/admin/students/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                  {r.name}
                </Link>
                <div className="text-xs text-slate-500">
                  <span className="font-mono">{r.registrationNumber}</span>
                  {r.portalRegNo ? ` · ${r.portalRegNo}` : ""}
                </div>
              </TD>
              <TD>{r.college}</TD>
              <TD>{r.session ?? "—"}</TD>
              <TD>
                <StatusBadge status={r.status} />
              </TD>
              <TD className="whitespace-nowrap">{formatDate(r.internshipStart)}</TD>
              <TD>
                {!r.mentor ? (
                  <Badge tone="amber">Unassigned</Badge>
                ) : r.mentor.id === mentorId ? (
                  <Badge tone="green">This mentor</Badge>
                ) : (
                  <span className="text-sm text-slate-700">
                    {r.mentor.name} <span className="text-xs text-slate-400">({r.mentor.employeeId})</span>
                  </span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <ConfirmDialog
        open={confirm === "assign"}
        onClose={() => setConfirm(null)}
        onConfirm={() => doAction("assign")}
        loading={loading}
        title="Reassign students?"
        confirmLabel={`Assign ${assignable.length}`}
        description={`${reassigning.length} of the selected students already have another mentor. They will be moved to this mentor.`}
      />
      <ConfirmDialog
        open={confirm === "remove"}
        onClose={() => setConfirm(null)}
        onConfirm={() => doAction("remove")}
        loading={loading}
        tone="danger"
        title="Remove students from this mentor?"
        confirmLabel={`Remove ${removable.length}`}
        description="The students will become unassigned until you assign another mentor."
      />
    </>
  );
}
