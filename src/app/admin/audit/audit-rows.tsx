"use client";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TR, TD } from "@/components/ui/table";
import { Badge, type Tone } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { JsonView } from "@/components/admin/ops/json-view";

export interface AuditRow {
  id: string;
  at: string;
  action: string;
  actor: string | null;
  actorRole: string | null;
  entity: string;
  entityId: string | null;
  details: string;
  ip: string | null;
}

const toneFor = (a: string): Tone =>
  a.startsWith("PAYMENT") ? "green" : a === "SETTLEMENT" ? "teal" : a === "BULK_JOB" ? "violet" : a.startsWith("PASSWORD") ? "red" : a.startsWith("STUDENT") ? "blue" : a === "LOGIN" ? "gray" : "brand";

import { actionLabel } from "./labels";

function summary(details: string): string {
  try {
    const d = JSON.parse(details) as Record<string, unknown>;
    const bits: string[] = [];
    for (const k of ["operation", "reason", "title", "type", "receiptNo", "college", "student"]) {
      const v = d[k];
      if (typeof v === "string" && v) bits.push(v);
    }
    return bits.join(" · ").slice(0, 140);
  } catch {
    return "";
  }
}

export function AuditRows({ rows }: { rows: AuditRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <>
      {rows.map((r) => {
        const isOpen = open.has(r.id);
        return (
          <Fragment key={r.id}>
            <TR className="cursor-pointer" onClick={() => toggle(r.id)} aria-expanded={isOpen}>
              <TD className="w-8 pr-0">
                <button type="button" aria-label={isOpen ? "Hide details" : "Show details"} className="text-slate-400 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); toggle(r.id); }}>
                  {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
              </TD>
              <TD className="text-xs whitespace-nowrap">{formatDateTime(r.at)}</TD>
              <TD>
                <Badge tone={toneFor(r.action)}>{actionLabel(r.action)}</Badge>
              </TD>
              <TD>
                <p className="font-medium text-slate-900">{r.actor ?? "System"}</p>
                {r.actorRole && <p className="text-xs text-slate-500">{r.actorRole.charAt(0) + r.actorRole.slice(1).toLowerCase()}</p>}
              </TD>
              <TD>
                <p className="text-slate-800">{r.entity}</p>
                {r.entityId && <p className="max-w-[160px] truncate font-mono text-[11px] text-slate-500">{r.entityId}</p>}
              </TD>
              <TD className="hidden max-w-[320px] truncate text-xs text-slate-600 lg:table-cell">{summary(r.details) || "—"}</TD>
              <TD className="font-mono text-xs text-slate-500">{r.ip ?? "—"}</TD>
            </TR>
            {isOpen && (
              <tr className="bg-slate-50/60">
                <td colSpan={7} className="px-5 py-3">
                  <JsonView value={r.details} emptyLabel="No details recorded." />
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
