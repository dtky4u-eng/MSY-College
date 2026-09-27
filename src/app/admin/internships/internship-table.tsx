"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, CalendarPlus, ChevronRight, Inbox, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page";
import { ProgressBar } from "@/components/ui/progress";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StartDialog, type StartTarget } from "./start-dialog";

export type InternshipTab = "awaiting" | "scheduled" | "active" | "completed";

export interface InternshipRow {
  id: string;
  name: string;
  registrationNumber: string;
  portalRegNo: string | null;
  photoUrl: string | null;
  college: string;
  collegeCode: string;
  session: string | null;
  domain: string | null;
  domainCode: string | null;
  hasDomain: boolean;
  mentor: string | null;
  start: string | null;
  end: string | null;
  paidAt: string | null;
  completedAt: string | null;
  progress: number | null;
}

const EMPTY: Record<InternshipTab, { title: string; description: string }> = {
  awaiting: { title: "No students are waiting", description: "Paid students without a start date appear here." },
  scheduled: { title: "Nothing scheduled", description: "Students with a future start date appear here." },
  active: { title: "No active internships", description: "Students whose internship has started appear here." },
  completed: { title: "No completed internships", description: "Completed internships appear here." },
};

function daysUntil(ymd: string, today: string) {
  return Math.round((new Date(ymd + "T00:00:00+05:30").getTime() - new Date(today + "T00:00:00+05:30").getTime()) / 86400000);
}

/** Internship list with checkbox selection and single/bulk start-date scheduling (FR-ADM-7). */
export function InternshipTable({ rows, tab, defaultWeeks, today, filtered }: { rows: InternshipRow[]; tab: InternshipTab; defaultWeeks: number; today: string; filtered: boolean }) {
  const selectable = tab === "awaiting" || tab === "scheduled";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<StartTarget[] | null>(null);

  const visibleSelected = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const allChecked = rows.length > 0 && visibleSelected.length === rows.length;
  const someChecked = visibleSelected.length > 0 && !allChecked;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const toTarget = (r: InternshipRow): StartTarget => ({ id: r.id, name: r.name, hasMentor: Boolean(r.mentor), start: r.start, end: r.end });

  const dialog = (
    <StartDialog
      open={targets !== null}
      targets={targets ?? []}
      defaultWeeks={defaultWeeks}
      today={today}
      onClose={() => setTargets(null)}
      onDone={() => {
        setTargets(null);
        setSelected(new Set());
      }}
    />
  );

  if (rows.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Inbox />}
          title={filtered ? "No students match your filters" : EMPTY[tab].title}
          description={filtered ? "Try a different search term or clear some filters." : EMPTY[tab].description}
        />
        {dialog}
      </>
    );
  }

  return (
    <>
      {selectable && visibleSelected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-brand-50/70 px-5 py-2.5" role="region" aria-label="Bulk actions">
          <p className="text-sm font-medium text-brand-900">
            {visibleSelected.length} selected
            <button type="button" onClick={() => setSelected(new Set())} className="ml-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
              <X className="size-3" /> Clear
            </button>
          </p>
          <Button size="sm" icon={tab === "awaiting" ? <CalendarPlus className="size-4" /> : <CalendarClock className="size-4" />} onClick={() => setTargets(visibleSelected.map(toTarget))}>
            {tab === "awaiting" ? "Set start date" : "Reschedule"} for {visibleSelected.length}
          </Button>
        </div>
      )}
      <Table>
        <THead>
          <tr>
            {selectable && (
              <TH className="w-10">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300 accent-brand-600"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all students on this page"
                />
              </TH>
            )}
            <TH>Student</TH>
            <TH>College</TH>
            <TH>Domain</TH>
            <TH>Mentor</TH>
            {tab === "awaiting" ? <TH>Paid on</TH> : <TH>Dates</TH>}
            {(tab === "active" || tab === "completed") && <TH className="min-w-32">Learning</TH>}
            <TH className="text-right">Actions</TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => {
            const checked = selected.has(r.id);
            const until = r.start ? daysUntil(r.start, today) : null;
            return (
              <TR key={r.id} className={checked ? "bg-brand-50/50" : undefined}>
                {selectable && (
                  <TD className="w-10">
                    <input type="checkbox" className="size-4 rounded border-slate-300 accent-brand-600" checked={checked} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
                  </TD>
                )}
                <TD>
                  <div className="flex min-w-52 items-center gap-3">
                    <Avatar name={r.name} src={r.photoUrl} size={34} />
                    <div className="min-w-0">
                      <Link href={`/admin/students/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {r.name}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">{r.portalRegNo ?? r.registrationNumber}</p>
                    </div>
                  </div>
                </TD>
                <TD className="max-w-52">
                  <p className="truncate" title={r.college}>
                    {r.college}
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.collegeCode}
                    {r.session ? ` · ${r.session}` : ""}
                  </p>
                </TD>
                <TD className="whitespace-nowrap">{r.domainCode ? <span title={r.domain ?? undefined}>{r.domainCode}</span> : <Badge tone="amber">No domain</Badge>}</TD>
                <TD className="whitespace-nowrap">{r.mentor ?? <span className="text-slate-400">Not assigned</span>}</TD>
                {tab === "awaiting" ? (
                  <TD className="whitespace-nowrap">{r.paidAt ? formatDate(r.paidAt) : "—"}</TD>
                ) : (
                  <TD className="whitespace-nowrap">
                    <p className="tabular-nums">
                      {formatDate(r.start)} – {formatDate(r.end)}
                    </p>
                    {tab === "scheduled" && until !== null && (
                      <p className="text-xs text-slate-500">
                        Starts in {until} day{until === 1 ? "" : "s"}
                      </p>
                    )}
                    {tab === "completed" && r.completedAt && <p className="text-xs text-slate-500">Completed {formatDate(r.completedAt)}</p>}
                  </TD>
                )}
                {(tab === "active" || tab === "completed") && (
                  <TD>{r.hasDomain && r.progress !== null ? <ProgressBar value={r.progress} size="sm" showLabel tone={r.progress >= 100 ? "green" : "brand"} /> : <span className="text-xs text-slate-400">—</span>}</TD>
                )}
                <TD className="text-right whitespace-nowrap">
                  {selectable ? (
                    <Button variant={tab === "awaiting" ? "secondary" : "outline"} size="xs" onClick={() => setTargets([toTarget(r)])}>
                      {tab === "awaiting" ? "Set start date" : "Reschedule"}
                    </Button>
                  ) : (
                    <ButtonLink href={`/admin/students/${r.id}`} variant="ghost" size="xs">
                      View <ChevronRight className="size-3.5" />
                    </ButtonLink>
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      {dialog}
    </>
  );
}
