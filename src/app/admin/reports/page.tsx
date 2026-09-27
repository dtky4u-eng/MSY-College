import { BarChart3, FileSpreadsheet, FileText } from "lucide-react";
import { requirePageRole } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { STUDENT_STATUS } from "@/lib/constants";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/tabs";
import { DateFilter, FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { studentFilterOptions } from "@/components/admin/ops/lookups";
import { REPORT_TYPES, buildReport, parseFilters, parseType } from "./_lib/build";

export const metadata = { title: "Reports & Analytics" };

const DESCRIPTIONS: Record<string, string> = {
  registration: "Every uploaded student with registration and payment status. Date range filters the registration date.",
  attendance: "Attendance summary for paid students whose internship has started. Date range limits the attendance window.",
  completion: "Learning, hours, attendance, assessment, result and certificate for paid students. Date range filters the completion date.",
  payment: "All payment transactions with gateway and receipt details. Date range filters the transaction date.",
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const type = parseType(typeof sp.type === "string" ? sp.type : undefined);
  const filters = parseFilters(sp);
  const { page, pageSize, skip, take } = pagination(sp, 25);
  const [report, opts] = await Promise.all([buildReport(type, filters, { skip, take }), studentFilterOptions()]);

  const qs = new URLSearchParams();
  qs.set("type", type);
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
  const exportUrl = (format: "xlsx" | "pdf") => `/api/admin/reports/export?${qs.toString()}&format=${format}`;

  const paymentOptions =
    type === "payment"
      ? [
          { value: "SUCCESS", label: "Success" },
          { value: "CREATED", label: "Created" },
          { value: "PENDING", label: "Pending" },
          { value: "FAILED", label: "Failed" },
          { value: "VERIFY_FAILED", label: "Verification failed" },
          { value: "REFUNDED", label: "Refunded" },
        ]
      : [
          { value: "PAID", label: "Paid" },
          { value: "UNPAID", label: "Unpaid" },
        ];
  const hidePaymentFilter = type === "attendance" || type === "completion"; // these reports cover paid students only

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Preview registration, attendance, completion and payment reports with filters, then export them to Excel or PDF."
        actions={
          <>
            <ButtonLink href={exportUrl("xlsx")} external variant="outline" icon={<FileSpreadsheet className="size-4" />}>
              Export Excel
            </ButtonLink>
            <ButtonLink href={exportUrl("pdf")} external variant="outline" icon={<FileText className="size-4" />}>
              Export PDF
            </ButtonLink>
          </>
        }
      />
      <Card>
        <LinkTabs param="type" className="px-3" items={REPORT_TYPES.map((t) => ({ key: t.value, label: t.label }))} />
        <p className="border-b border-slate-100 px-5 py-2.5 text-xs text-slate-500">{DESCRIPTIONS[type]}</p>
        <FilterBar>
          <SearchInput placeholder="Student name or reg. no.…" className="sm:w-64" />
          <FilterSelect param="college" placeholder="All colleges" label="College" options={opts.colleges} className="max-w-[220px]" />
          <FilterSelect param="domain" placeholder="All domains" label="Domain" options={opts.domains} className="max-w-[200px]" />
          <FilterSelect param="session" placeholder="All sessions" label="Session" options={opts.sessions} />
          <FilterSelect param="semester" placeholder="All semesters" label="Semester" options={opts.semesters} />
          <FilterSelect param="status" placeholder="Any internship status" label="Internship status" options={STUDENT_STATUS.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} />
          {!hidePaymentFilter && <FilterSelect param="payment" placeholder={type === "payment" ? "Any payment status" : "Paid & unpaid"} label="Payment status" options={paymentOptions} />}
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <DateFilter param="from" label={`${report.dateBasis} from`} />
            <span aria-hidden>–</span>
            <DateFilter param="to" label={`${report.dateBasis} to`} />
          </div>
        </FilterBar>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
          {report.summary.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              {s.label}
              <b className="text-sm text-slate-900 tabular-nums">{s.value}</b>
            </span>
          ))}
        </div>
        {report.total === 0 ? (
          <EmptyState icon={<BarChart3 />} title="No records for these filters" description="Adjust or clear the filters to see data." />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  {report.columns.map((c) => (
                    <TH key={c.key} className={cn(c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                      {c.header}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {report.rows.map((r, i) => (
                  <TR key={i}>
                    {report.columns.map((c, j) => (
                      <TD key={c.key} className={cn("whitespace-nowrap", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center tabular-nums", j === 0 && "font-medium text-slate-900")}>
                        {r[c.key] ?? "—"}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={report.total} />
          </>
        )}
      </Card>
    </>
  );
}
