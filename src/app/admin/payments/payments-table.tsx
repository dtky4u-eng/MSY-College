"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDateTime, formatINR } from "@/lib/format";
import { PaymentDrawer } from "./payment-drawer";
import { GATEWAY_LABEL } from "./labels";

export interface PaymentRow {
  id: string;
  transactionId: string;
  studentName: string;
  registrationNumber: string;
  portalRegNo: string | null;
  college: string;
  gateway: string;
  method: string | null;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  receiptNo: string | null;
  manual: boolean;
}

export function PaymentsTable({ rows, filtered }: { rows: PaymentRow[]; filtered: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>Transaction</TH>
            <TH>Student</TH>
            <TH className="hidden lg:table-cell">College</TH>
            <TH>Gateway</TH>
            <TH className="text-right">Amount</TH>
            <TH>Status</TH>
            <TH className="hidden md:table-cell">Date</TH>
            <TH>
              <span className="sr-only">Open</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 && <EmptyRow colSpan={8}>{filtered ? "No payments match these filters." : "No payments have been recorded yet."}</EmptyRow>}
          {rows.map((r) => (
            <TR
              key={r.id}
              className="cursor-pointer"
              onClick={() => setOpenId(r.id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenId(r.id);
                }
              }}
              aria-label={`Open payment ${r.transactionId}`}
            >
              <TD>
                <p className="font-mono text-xs font-medium text-slate-900">{r.transactionId}</p>
                {r.receiptNo && <p className="mt-0.5 text-xs text-slate-500">{r.receiptNo}</p>}
              </TD>
              <TD>
                <p className="font-medium text-slate-900">{r.studentName}</p>
                <p className="text-xs text-slate-500">
                  {r.registrationNumber}
                  {r.portalRegNo ? ` · ${r.portalRegNo}` : ""}
                </p>
              </TD>
              <TD className="hidden max-w-[220px] truncate lg:table-cell">{r.college}</TD>
              <TD>
                <p>{GATEWAY_LABEL[r.gateway] ?? r.gateway}</p>
                {r.method && <p className="text-xs text-slate-500 uppercase">{r.method}</p>}
              </TD>
              <TD className="text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">{formatINR(r.amount)}</TD>
              <TD>
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={r.status} />
                  {r.manual && <Badge tone="violet">Manual</Badge>}
                </div>
              </TD>
              <TD className="hidden whitespace-nowrap text-xs md:table-cell">
                <p>{formatDateTime(r.createdAt)}</p>
                {r.paidAt && <p className="text-emerald-700">Paid {formatDateTime(r.paidAt)}</p>}
              </TD>
              <TD className="text-right">
                <ChevronRight className="inline size-4 text-slate-400" />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <PaymentDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
