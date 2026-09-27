// Report builders for Reports & Analytics (FR-ADM-14). Shared by the preview page and the export endpoint.
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ExportColumn } from "@/lib/pdf/table";
import { attendanceStats } from "@/lib/student";
import { formatDate, formatINR, formatNumber, istDate, toISTDateString } from "@/lib/format";
import { istRange } from "@/components/admin/ops/lookups";

export const REPORT_TYPES = [
  { value: "registration", label: "Registration" },
  { value: "attendance", label: "Attendance" },
  { value: "completion", label: "Completion" },
  { value: "payment", label: "Payment" },
] as const;
export type ReportType = (typeof REPORT_TYPES)[number]["value"];

export interface ReportFilters {
  college?: string;
  domain?: string;
  session?: string;
  semester?: string;
  status?: string; // internship status
  payment?: string; // student payment status, or payment record status for the payment report
  from?: string;
  to?: string;
  q?: string;
}

export interface ReportResult {
  type: ReportType;
  title: string;
  dateBasis: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
  total: number;
  summary: { label: string; value: string }[];
}

const MAX_ROWS = 5000;
const GATEWAY: Record<string, string> = { RAZORPAY: "Razorpay", CASHFREE: "Cashfree", SANDBOX: "Sandbox", MANUAL: "Manual" };
const STATUS: Record<string, string> = { PENDING: "Pending", ACTIVE: "Active", COMPLETED: "Completed", BLOCKED: "Blocked", PAID: "Paid", UNPAID: "Unpaid" };
const PAY_STATUS: Record<string, string> = { CREATED: "Created", PENDING: "Pending", SUCCESS: "Success", FAILED: "Failed", REFUNDED: "Refunded", VERIFY_FAILED: "Verification failed" };

export function parseFilters(sp: URLSearchParams | Record<string, string | string[] | undefined>): ReportFilters {
  const get = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k];
    return v && v.trim() ? v.trim() : undefined;
  };
  const ymd = (k: string) => {
    const v = get(k);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  };
  return { college: get("college"), domain: get("domain"), session: get("session"), semester: get("semester"), status: get("status"), payment: get("payment"), from: ymd("from"), to: ymd("to"), q: get("q") };
}

export function parseType(v: string | null | undefined): ReportType {
  return (REPORT_TYPES.find((t) => t.value === v)?.value ?? "registration") as ReportType;
}

function studentWhere(f: ReportFilters, withPayment = true): Prisma.StudentWhereInput {
  return {
    ...(f.college ? { collegeId: f.college } : {}),
    ...(f.domain ? { domainId: f.domain } : {}),
    ...(f.session ? { session: f.session } : {}),
    ...(f.semester ? { semester: f.semester } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(withPayment && f.payment && (f.payment === "PAID" || f.payment === "UNPAID") ? { paymentStatus: f.payment } : {}),
    ...(f.q ? { OR: [{ name: { contains: f.q } }, { registrationNumber: { contains: f.q } }, { portalRegNo: { contains: f.q } }] } : {}),
  };
}

type Paging = { skip: number; take: number } | null;

export async function buildReport(type: ReportType, f: ReportFilters, paging: Paging): Promise<ReportResult> {
  if (type === "registration") return registration(f, paging);
  if (type === "attendance") return attendance(f, paging);
  if (type === "completion") return completion(f, paging);
  return payment(f, paging);
}

const page = <T,>(rows: T[], paging: Paging) => (paging ? rows.slice(paging.skip, paging.skip + paging.take) : rows.slice(0, MAX_ROWS));

// ───────────── Registration ─────────────

async function registration(f: ReportFilters, paging: Paging): Promise<ReportResult> {
  const range = istRange(f.from, f.to);
  const where: Prisma.StudentWhereInput = { ...studentWhere(f), ...(range ? { registeredAt: range } : {}) };
  const [total, list, byPay, registered] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: [{ registeredAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
      skip: paging?.skip ?? 0,
      take: paging?.take ?? MAX_ROWS,
      select: { name: true, registrationNumber: true, portalRegNo: true, session: true, semester: true, registeredAt: true, paymentStatus: true, status: true, college: { select: { name: true } }, domain: { select: { name: true } } },
    }),
    prisma.student.groupBy({ by: ["paymentStatus"], where, _count: { _all: true } }),
    prisma.student.count({ where: { ...where, registeredAt: { not: null, ...(range ?? {}) } } }),
  ]);
  const paid = byPay.find((b) => b.paymentStatus === "PAID")?._count._all ?? 0;
  return {
    type: "registration",
    title: "Registration Report",
    dateBasis: "Registered on",
    total,
    summary: [
      { label: "Students", value: formatNumber(total) },
      { label: "Registered", value: formatNumber(registered) },
      { label: "Paid", value: formatNumber(paid) },
      { label: "Unpaid", value: formatNumber(total - paid) },
    ],
    columns: [
      { key: "student", header: "Student", width: 1.6 },
      { key: "regNo", header: "Reg. No.", width: 1.3 },
      { key: "portalNo", header: "Portal No.", width: 1.2 },
      { key: "college", header: "College", width: 1.8 },
      { key: "domain", header: "Domain", width: 1.4 },
      { key: "session", header: "Session", width: 0.8 },
      { key: "semester", header: "Sem.", width: 0.5, align: "center" },
      { key: "registeredOn", header: "Registered On", width: 1 },
      { key: "payment", header: "Payment", width: 0.8 },
      { key: "status", header: "Status", width: 0.8 },
    ],
    rows: list.map((s) => ({
      student: s.name,
      regNo: s.registrationNumber,
      portalNo: s.portalRegNo ?? "—",
      college: s.college.name,
      domain: s.domain?.name ?? "—",
      session: s.session ?? "—",
      semester: s.semester ?? "—",
      registeredOn: s.registeredAt ? formatDate(s.registeredAt) : "Not registered",
      payment: STATUS[s.paymentStatus] ?? s.paymentStatus,
      status: STATUS[s.status] ?? s.status,
    })),
  };
}

// ───────────── Attendance ─────────────

async function attendance(f: ReportFilters, paging: Paging): Promise<ReportResult> {
  const where: Prisma.StudentWhereInput = { ...studentWhere(f), paymentStatus: "PAID", internshipStart: { not: null } };
  const students = await prisma.student.findMany({
    where,
    orderBy: { name: "asc" },
    take: MAX_ROWS,
    select: { id: true, name: true, registrationNumber: true, portalRegNo: true, internshipStart: true, internshipEnd: true, college: { select: { name: true } }, domain: { select: { name: true } } },
  });
  const att = await prisma.attendance.findMany({
    where: { studentId: { in: students.map((s) => s.id) }, ...(f.from || f.to ? { date: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}) },
    select: { studentId: true, date: true, status: true, generated: true },
  });
  const byStudent = new Map<string, { date: string; status: string; generated: boolean }[]>();
  for (const a of att) {
    const l = byStudent.get(a.studentId) ?? [];
    l.push(a);
    byStudent.set(a.studentId, l);
  }
  const rows: (Record<string, string | number> & { _pct: number; _gen: number; _present: number })[] = [];
  for (const s of students) {
    let start = s.internshipStart!;
    let end = s.internshipEnd;
    if (f.from && f.from > toISTDateString(start)) start = istDate(f.from);
    if (f.to && (!end || f.to < toISTDateString(end))) end = istDate(f.to);
    if (end && toISTDateString(end) < toISTDateString(start)) continue; // window outside the filter range
    const list = byStudent.get(s.id) ?? [];
    const st = await attendanceStats(s.id, start, end, { rows: list });
    const gen = list.filter((r) => r.generated).length;
    rows.push({
      student: s.name,
      regNo: s.portalRegNo ?? s.registrationNumber,
      college: s.college.name,
      domain: s.domain?.name ?? "—",
      workingDays: st.workingDays,
      present: st.present,
      halfDay: st.halfDay,
      leave: st.leave,
      absent: st.absent,
      percent: `${st.percent}%`,
      generated: gen,
      _pct: st.percent,
      _gen: gen,
      _present: st.present,
    });
  }
  const avg = rows.length ? Math.round((rows.reduce((a, r) => a + r._pct, 0) / rows.length) * 10) / 10 : 0;
  const clean = page(rows, paging).map(({ _pct, _gen, _present, ...r }) => r);
  return {
    type: "attendance",
    title: "Attendance Report",
    dateBasis: "Attendance date",
    total: rows.length,
    summary: [
      { label: "Students", value: formatNumber(rows.length) },
      { label: "Average attendance", value: `${avg}%` },
      { label: "Below 75%", value: formatNumber(rows.filter((r) => r._pct < 75).length) },
      { label: "Present days", value: formatNumber(rows.reduce((a, r) => a + r._present, 0)) },
      { label: "Generated rows", value: formatNumber(rows.reduce((a, r) => a + r._gen, 0)) },
    ],
    columns: [
      { key: "student", header: "Student", width: 1.6 },
      { key: "regNo", header: "Reg. No.", width: 1.2 },
      { key: "college", header: "College", width: 1.8 },
      { key: "domain", header: "Domain", width: 1.3 },
      { key: "workingDays", header: "Working Days", width: 0.8, align: "right" },
      { key: "present", header: "Present", width: 0.7, align: "right" },
      { key: "halfDay", header: "Half Day", width: 0.7, align: "right" },
      { key: "leave", header: "Leave", width: 0.6, align: "right" },
      { key: "absent", header: "Absent", width: 0.6, align: "right" },
      { key: "percent", header: "Attendance %", width: 0.8, align: "right" },
      { key: "generated", header: "Generated", width: 0.7, align: "right" },
    ],
    rows: clean,
  };
}

// ───────────── Completion ─────────────

async function completion(f: ReportFilters, paging: Paging): Promise<ReportResult> {
  const range = istRange(f.from, f.to);
  const where: Prisma.StudentWhereInput = { ...studentWhere(f), paymentStatus: "PAID", ...(range ? { completedAt: range } : {}) };
  const students = await prisma.student.findMany({
    where,
    orderBy: [{ completedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    take: MAX_ROWS,
    select: {
      id: true,
      name: true,
      registrationNumber: true,
      portalRegNo: true,
      domainId: true,
      status: true,
      internshipStart: true,
      internshipEnd: true,
      resultStatus: true,
      grade: true,
      completedAt: true,
      domain: { select: { name: true, durationHours: true } },
      college: { select: { name: true } },
      assessment: { select: { score: true, recommendCertificate: true } },
      certificate: { select: { certificateNo: true, revokedAt: true } },
    },
  });
  const ids = students.map((s) => s.id);
  const domainIds = [...new Set(students.map((s) => s.domainId).filter((d): d is string => Boolean(d)))];
  const [chapters, done, logs, att] = await Promise.all([
    prisma.chapter.findMany({ where: { module: { domainId: { in: domainIds } } }, select: { module: { select: { domainId: true } } } }),
    prisma.chapterProgress.groupBy({ by: ["studentId"], where: { studentId: { in: ids }, completed: true }, _count: { _all: true } }),
    prisma.logbookEntry.groupBy({ by: ["studentId"], where: { studentId: { in: ids } }, _sum: { hours: true } }),
    prisma.attendance.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, date: true, status: true } }),
  ]);
  const chaptersPerDomain = new Map<string, number>();
  for (const c of chapters) chaptersPerDomain.set(c.module.domainId, (chaptersPerDomain.get(c.module.domainId) ?? 0) + 1);
  const doneMap = new Map(done.map((d) => [d.studentId, d._count._all]));
  const hoursMap = new Map(logs.map((l) => [l.studentId, Math.round((l._sum.hours ?? 0) * 10) / 10]));
  const attMap = new Map<string, { date: string; status: string }[]>();
  for (const a of att) {
    const l = attMap.get(a.studentId) ?? [];
    l.push(a);
    attMap.set(a.studentId, l);
  }
  const rows: Record<string, string | number>[] = [];
  let pass = 0;
  let certs = 0;
  let completed = 0;
  for (const s of students) {
    const st = await attendanceStats(s.id, s.internshipStart, s.internshipEnd, { rows: attMap.get(s.id) ?? [] });
    const total = s.domainId ? chaptersPerDomain.get(s.domainId) ?? 0 : 0;
    const cert = s.certificate && !s.certificate.revokedAt ? s.certificate.certificateNo : null;
    if (s.resultStatus === "PASS") pass++;
    if (cert) certs++;
    if (s.status === "COMPLETED") completed++;
    rows.push({
      student: s.name,
      regNo: s.portalRegNo ?? s.registrationNumber,
      college: s.college.name,
      domain: s.domain?.name ?? "—",
      chapters: `${Math.min(doneMap.get(s.id) ?? 0, total)}/${total}`,
      hours: `${hoursMap.get(s.id) ?? 0} / ${s.domain?.durationHours ?? 120}`,
      attendance: `${st.percent}%`,
      assessment: s.assessment ? `${s.assessment.score}%${s.assessment.recommendCertificate ? " (rec.)" : ""}` : "Pending",
      result: s.resultStatus === "PASS" ? "Pass" : s.resultStatus === "FAIL" ? "Fail" : "—",
      grade: s.grade ?? "—",
      certificate: cert ?? "—",
      completedOn: s.completedAt ? formatDate(s.completedAt) : STATUS[s.status] ?? s.status,
    });
  }
  return {
    type: "completion",
    title: "Completion Report",
    dateBasis: "Completed on",
    total: rows.length,
    summary: [
      { label: "Students", value: formatNumber(rows.length) },
      { label: "Completed", value: formatNumber(completed) },
      { label: "Passed", value: formatNumber(pass) },
      { label: "Certificates", value: formatNumber(certs) },
    ],
    columns: [
      { key: "student", header: "Student", width: 1.5 },
      { key: "regNo", header: "Reg. No.", width: 1.1 },
      { key: "college", header: "College", width: 1.5 },
      { key: "domain", header: "Domain", width: 1.2 },
      { key: "chapters", header: "Chapters", width: 0.7, align: "center" },
      { key: "hours", header: "Hours", width: 0.8, align: "center" },
      { key: "attendance", header: "Attendance", width: 0.8, align: "right" },
      { key: "assessment", header: "Assessment", width: 0.9 },
      { key: "result", header: "Result", width: 0.6 },
      { key: "grade", header: "Grade", width: 0.5, align: "center" },
      { key: "certificate", header: "Certificate No.", width: 1.4 },
      { key: "completedOn", header: "Completed On", width: 0.9 },
    ],
    rows: page(rows, paging),
  };
}

// ───────────── Payment ─────────────

async function payment(f: ReportFilters, paging: Paging): Promise<ReportResult> {
  const range = istRange(f.from, f.to);
  const where: Prisma.PaymentWhereInput = {
    student: studentWhere(f, false),
    ...(f.payment && PAY_STATUS[f.payment] ? { status: f.payment } : {}),
    ...(range ? { createdAt: range } : {}),
  };
  const [total, list, byStatus] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paging?.skip ?? 0,
      take: paging?.take ?? MAX_ROWS,
      include: { student: { select: { name: true, registrationNumber: true, college: { select: { name: true } }, domain: { select: { name: true } } } } },
    }),
    prisma.payment.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { amount: true } }),
  ]);
  const s = (st: string) => byStatus.find((b) => b.status === st);
  return {
    type: "payment",
    title: "Payment Report",
    dateBasis: "Created on",
    total,
    summary: [
      { label: "Transactions", value: formatNumber(total) },
      { label: "Collected", value: formatINR(s("SUCCESS")?._sum.amount ?? 0) },
      { label: "Successful", value: formatNumber(s("SUCCESS")?._count._all ?? 0) },
      { label: "Failed", value: formatNumber((s("FAILED")?._count._all ?? 0) + (s("VERIFY_FAILED")?._count._all ?? 0)) },
      { label: "Refunded", value: formatNumber(s("REFUNDED")?._count._all ?? 0) },
    ],
    columns: [
      { key: "transactionId", header: "Transaction ID", width: 1.5 },
      { key: "student", header: "Student", width: 1.4 },
      { key: "college", header: "College", width: 1.5 },
      { key: "domain", header: "Domain", width: 1.2 },
      { key: "gateway", header: "Gateway", width: 0.8 },
      { key: "method", header: "Method", width: 0.7 },
      { key: "amount", header: "Amount", width: 0.8, align: "right" },
      { key: "status", header: "Status", width: 0.9 },
      { key: "paidAt", header: "Paid At", width: 0.9 },
      { key: "receiptNo", header: "Receipt No.", width: 1.3 },
    ],
    rows: list.map((p) => ({
      transactionId: p.transactionId,
      student: `${p.student.name} (${p.student.registrationNumber})`,
      college: p.student.college.name,
      domain: p.student.domain?.name ?? "—",
      gateway: GATEWAY[p.gateway] ?? p.gateway,
      method: p.method ? p.method.toUpperCase() : "—",
      amount: formatINR(p.amount),
      status: PAY_STATUS[p.status] ?? p.status,
      paidAt: p.paidAt ? formatDate(p.paidAt) : "—",
      receiptNo: p.receiptNo ?? "—",
    })),
  };
}
