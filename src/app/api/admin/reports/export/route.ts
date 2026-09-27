import { badRequest, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { rowsToExcel } from "@/lib/excel";
import { rowsToPdf } from "@/lib/pdf/table";
import { toISTDateString, formatDate } from "@/lib/format";
import { prisma } from "@/lib/db";
import { buildReport, parseFilters, parseType } from "@/app/admin/reports/_lib/build";

/** Export a report to Excel or PDF (FR-ADM-14). GET ?type=registration|attendance|completion|payment&format=xlsx|pdf&…filters */
export const GET = route(async (req) => {
  await requireApiRole("ADMIN");
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") ?? "xlsx";
  if (format !== "xlsx" && format !== "pdf") throw badRequest("Format must be xlsx or pdf");
  const type = parseType(sp.get("type"));
  const filters = parseFilters(sp);
  const report = await buildReport(type, filters, null);
  const stamp = toISTDateString();
  const filename = `${type}-report-${stamp}.${format}`;

  if (format === "xlsx") {
    const buf = await rowsToExcel(report.title.replace(" Report", ""), report.columns, report.rows);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Human-readable filter line for the PDF subtitle.
  const [college, domain] = await Promise.all([
    filters.college ? prisma.college.findUnique({ where: { id: filters.college }, select: { name: true } }) : null,
    filters.domain ? prisma.domain.findUnique({ where: { id: filters.domain }, select: { name: true } }) : null,
  ]);
  const parts = [
    college?.name,
    domain?.name,
    filters.session && `Session ${filters.session}`,
    filters.semester && `Semester ${filters.semester}`,
    filters.status && `Status: ${filters.status.toLowerCase()}`,
    filters.payment && `Payment: ${filters.payment.toLowerCase().replace("_", " ")}`,
    (filters.from || filters.to) && `${report.dateBasis}: ${filters.from ? formatDate(filters.from) : "…"} – ${filters.to ? formatDate(filters.to) : "…"}`,
  ].filter(Boolean);
  const pdf = await rowsToPdf(report.title, report.columns, report.rows, parts.length ? parts.join("  •  ") : "All records");
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
});
