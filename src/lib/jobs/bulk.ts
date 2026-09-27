// Bulk Automation Center (FR-ADM-13, NFR-7, G-9).
// Jobs run asynchronously inside the Next.js server process: a runner is started without awaiting,
// processes students one at a time, persists progress/log after every student and checks for
// cancellation between students. Every record it creates is flagged `generated: true` (G-9).
import "server-only";
import JSZip from "jszip";
import { z } from "zod";
import type { BulkJob, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../http";
import { audit } from "../audit";
import { saveGenerated } from "../files";
import { parseJson } from "../json";
import { ASSESSMENT_CRITERIA, BULK_OPERATIONS, DOCUMENT_LABEL, DOCUMENT_TYPES, type BulkOperation, type DocumentType } from "../constants";
import { toISTDateString, workingDaysBetween } from "../format";
import { assessmentScore, completeInternship, markChapterComplete, publishResult } from "../student";
import { documentAvailability, renderReceipt, renderStudentDocument } from "../pdf/documents";

export const MAX_STUDENTS = 500;
export const CONFIRM_WORD = "GENERATE";

/** Operations that create or change records (need a reason + typed confirmation). */
export const GENERATING_OPS: ReadonlySet<BulkOperation> = new Set<BulkOperation>(["FULL_LIFECYCLE", "ATTENDANCE", "LEARNING", "ASSESSMENT", "RESULTS", "COMPLETION", "LOGBOOKS"]);

const SINGLE_DOC: Partial<Record<BulkOperation, DocumentType>> = {
  OFFER_LETTERS: "OFFER_LETTER",
  ATTENDANCE_SHEETS: "ATTENDANCE_SHEET",
  LOGBOOKS: "LOGBOOK",
  REPORTS: "REPORT",
  CERTIFICATES: "CERTIFICATE",
};

// ───────────── Input schemas ─────────────

const optStr = z
  .string()
  .trim()
  .max(100)
  .optional()
  .nullable()
  .transform((v) => (v ? v : undefined));
const optYmd = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date");

export const bulkFiltersSchema = z
  .object({
    collegeId: optStr,
    domainId: optStr,
    session: optStr,
    semester: optStr,
    status: optStr,
    paymentStatus: optStr,
    startFrom: optYmd,
    startTo: optYmd,
    regNos: z
      .array(z.string().trim().max(60))
      .max(MAX_STUDENTS, `Paste at most ${MAX_STUDENTS} registration numbers`)
      .optional()
      .default([])
      .transform((a) => [...new Set(a.filter(Boolean))]),
  })
  .refine((f) => !f.startFrom || !f.startTo || f.startFrom <= f.startTo, { path: ["startTo"], message: "End of the start-date range must be after its beginning" });
export type BulkFilters = z.infer<typeof bulkFiltersSchema>;

export const bulkOptionsSchema = z
  .object({
    attendanceFrom: optYmd,
    attendanceTo: optYmd,
    presentRatio: z.coerce.number().int().min(50, "Present ratio must be at least 50%").max(100, "Present ratio cannot exceed 100%").optional().default(100),
    includeQuizzes: z.boolean().optional().default(true),
    includeReceipts: z.boolean().optional().default(true),
    generateSubmissions: z.boolean().optional().default(true),
  })
  .refine((o) => !o.attendanceFrom || !o.attendanceTo || o.attendanceFrom <= o.attendanceTo, { path: ["attendanceTo"], message: "End date must be on or after the start date" });
export type BulkOptions = z.infer<typeof bulkOptionsSchema>;

export const bulkOperationSchema = z.enum(BULK_OPERATIONS.map((o) => o.value) as [BulkOperation, ...BulkOperation[]], { message: "Choose an operation" });

// ───────────── Student selection ─────────────

const studentSelect = {
  id: true,
  name: true,
  registrationNumber: true,
  portalRegNo: true,
  paymentStatus: true,
  status: true,
  internshipStart: true,
  internshipEnd: true,
  domainId: true,
  mentorId: true,
  college: { select: { name: true } },
  domain: { select: { name: true, durationHours: true } },
  certificate: { select: { id: true, revokedAt: true } },
} satisfies Prisma.StudentSelect;
export type BulkStudent = Prisma.StudentGetPayload<{ select: typeof studentSelect }>;

function whereFor(f: BulkFilters): Prisma.StudentWhereInput {
  const start: Prisma.DateTimeNullableFilter = {};
  if (f.startFrom) start.gte = new Date(`${f.startFrom}T00:00:00+05:30`);
  if (f.startTo) start.lte = new Date(`${f.startTo}T23:59:59.999+05:30`);
  return {
    ...(f.collegeId ? { collegeId: f.collegeId } : {}),
    ...(f.domainId ? { domainId: f.domainId } : {}),
    ...(f.session ? { session: f.session } : {}),
    ...(f.semester ? { semester: f.semester } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.paymentStatus ? { paymentStatus: f.paymentStatus } : {}),
    ...(start.gte || start.lte ? { internshipStart: start } : {}),
    ...(f.regNos.length ? { OR: [{ registrationNumber: { in: f.regNos } }, { portalRegNo: { in: f.regNos } }] } : {}),
  };
}

/** Why a matched student is not processed by an operation (null = eligible). */
export function exclusionReason(s: BulkStudent, op: BulkOperation): string | null {
  if (s.paymentStatus !== "PAID") return "Not paid";
  if (!s.internshipStart) return "No start date";
  if (!s.domainId) return "No domain";
  if (GENERATING_OPS.has(op)) {
    if (s.status === "BLOCKED") return "Blocked";
    if (s.status === "COMPLETED") return "Already completed";
    if (toISTDateString(s.internshipStart) > toISTDateString()) return "Internship not started yet";
  }
  if (op === "CERTIFICATES" && (!s.certificate || s.certificate.revokedAt)) return "No certificate issued";
  return null;
}

export async function resolveStudents(filters: BulkFilters, op: BulkOperation) {
  const matched = await prisma.student.findMany({ where: whereFor(filters), select: studentSelect, orderBy: [{ collegeId: "asc" }, { name: "asc" }], take: 5000 });
  const eligible: BulkStudent[] = [];
  const excluded = new Map<string, number>();
  for (const s of matched) {
    const r = exclusionReason(s, op);
    if (r) excluded.set(r, (excluded.get(r) ?? 0) + 1);
    else eligible.push(s);
  }
  let unmatchedRegNos: string[] = [];
  if (filters.regNos.length) {
    const found = new Set(matched.flatMap((s) => [s.registrationNumber, s.portalRegNo].filter((x): x is string => Boolean(x))));
    unmatchedRegNos = filters.regNos.filter((r) => !found.has(r));
  }
  return { matched, eligible, excluded: [...excluded.entries()].map(([reason, count]) => ({ reason, count })), unmatchedRegNos };
}

// ───────────── Planning helpers (shared by preview and runner) ─────────────

function attendanceWindow(s: BulkStudent, o: BulkOptions): string[] {
  if (!s.internshipStart) return [];
  const today = toISTDateString();
  let from = toISTDateString(s.internshipStart);
  let to = s.internshipEnd ? toISTDateString(s.internshipEnd) : today;
  if (to > today) to = today;
  if (o.attendanceFrom && o.attendanceFrom > from) from = o.attendanceFrom;
  if (o.attendanceTo && o.attendanceTo < to) to = o.attendanceTo;
  return workingDaysBetween(from, to);
}

function logbookWindow(s: BulkStudent): string[] {
  if (!s.internshipStart) return [];
  const today = toISTDateString();
  const end = s.internshipEnd ? toISTDateString(s.internshipEnd) : today;
  return workingDaysBetween(toISTDateString(s.internshipStart), end < today ? end : today);
}

/** Split the missing hours over the free days (0.5 h steps, 1–8 h per day). */
function planLogbookHours(freeDays: number, neededHours: number): number[] {
  if (freeDays <= 0 || neededHours <= 0) return [];
  const per = Math.min(8, Math.max(1, Math.ceil((neededHours / freeDays) * 2) / 2));
  const out: number[] = [];
  let left = neededHours;
  for (let i = 0; i < freeDays && left > 0; i++) {
    const h = Math.min(per, Math.max(0.5, Math.ceil(left * 2) / 2));
    out.push(h);
    left -= h;
  }
  return out;
}

/** Deterministic spread: the first ⌊ratio⌋ share of every block is PRESENT, the rest ABSENT. */
function statusFor(index: number, ratioPct: number): "PRESENT" | "ABSENT" {
  if (ratioPct >= 100) return "PRESENT";
  const r = ratioPct / 100;
  return Math.floor((index + 1) * r) > Math.floor(index * r) ? "PRESENT" : "ABSENT";
}

// ───────────── Preview ─────────────

export interface BulkPreview {
  operation: BulkOperation;
  generating: boolean;
  matched: number;
  eligible: number;
  excluded: { reason: string; count: number }[];
  unmatchedRegNos: string[];
  overLimit: boolean;
  sample: { id: string; name: string; regNo: string; college: string; domain: string; status: string; start: string | null }[];
  workingDays: number;
  estimates: { label: string; value: number }[];
}

export async function previewBulk(op: BulkOperation, filters: BulkFilters, options: BulkOptions): Promise<BulkPreview> {
  const { matched, eligible, excluded, unmatchedRegNos } = await resolveStudents(filters, op);
  const ids = eligible.map((s) => s.id);
  const has = (...ops: BulkOperation[]) => ops.includes(op);
  const est: { label: string; value: number }[] = [];
  let workingDays = 0;

  const needAttendance = has("ATTENDANCE", "FULL_LIFECYCLE");
  const needLog = has("LOGBOOKS", "FULL_LIFECYCLE");
  const [attRows, logRows] = await Promise.all([
    needAttendance ? prisma.attendance.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, date: true } }) : Promise.resolve([]),
    needLog ? prisma.logbookEntry.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, date: true, hours: true } }) : Promise.resolve([]),
  ]);
  const attSet = new Set(attRows.map((a) => `${a.studentId}:${a.date}`));
  const logBy = new Map<string, { dates: Set<string>; hours: number }>();
  for (const l of logRows) {
    const e = logBy.get(l.studentId) ?? { dates: new Set<string>(), hours: 0 };
    e.dates.add(l.date);
    e.hours += l.hours;
    logBy.set(l.studentId, e);
  }

  let attendanceToCreate = 0;
  let logToCreate = 0;
  for (const s of eligible) {
    const win = needAttendance ? attendanceWindow(s, options) : logbookWindow(s);
    workingDays += win.length;
    if (needAttendance) attendanceToCreate += win.filter((d) => !attSet.has(`${s.id}:${d}`)).length;
    if (needLog) {
      const e = logBy.get(s.id);
      const free = logbookWindow(s).filter((d) => !e?.dates.has(d)).length;
      logToCreate += planLogbookHours(free, Math.max(0, (s.domain?.durationHours ?? 120) - (e?.hours ?? 0))).length;
    }
  }
  if (needAttendance) est.push({ label: "Attendance rows to create", value: attendanceToCreate });
  if (needLog) est.push({ label: "Logbook entries to create", value: logToCreate });

  if (has("LEARNING", "FULL_LIFECYCLE")) {
    const domainIds = [...new Set(eligible.map((s) => s.domainId!))];
    const [chapters, done, passed] = await Promise.all([
      prisma.chapter.findMany({ where: { module: { domainId: { in: domainIds } } }, select: { id: true, module: { select: { domainId: true } }, quiz: { select: { id: true } } } }),
      prisma.chapterProgress.findMany({ where: { studentId: { in: ids }, completed: true }, select: { studentId: true, chapterId: true } }),
      prisma.quizAttempt.findMany({ where: { studentId: { in: ids }, passed: true }, select: { studentId: true, quizId: true } }),
    ]);
    const doneSet = new Set(done.map((d) => `${d.studentId}:${d.chapterId}`));
    const passSet = new Set(passed.map((p) => `${p.studentId}:${p.quizId}`));
    let ch = 0;
    let qz = 0;
    for (const s of eligible) {
      for (const c of chapters) {
        if (c.module.domainId !== s.domainId) continue;
        if (!doneSet.has(`${s.id}:${c.id}`)) ch++;
        if (options.includeQuizzes && c.quiz && !passSet.has(`${s.id}:${c.quiz.id}`)) qz++;
      }
    }
    est.push({ label: "Chapters to mark complete", value: ch });
    if (options.includeQuizzes) est.push({ label: "Passing quiz attempts to create", value: qz });
  }
  if (has("ASSESSMENT", "FULL_LIFECYCLE")) {
    const existing = await prisma.assessment.count({ where: { studentId: { in: ids } } });
    est.push({ label: "Assessments to create", value: eligible.length - existing });
  }
  if (has("FULL_LIFECYCLE") && options.generateSubmissions) {
    const subs = await prisma.submission.findMany({ where: { studentId: { in: ids }, kind: { in: ["PROJECT", "REPORT"] }, status: "APPROVED" }, select: { studentId: true, kind: true } });
    const set = new Set(subs.map((x) => `${x.studentId}:${x.kind}`));
    est.push({ label: "Approved project / report records to create", value: eligible.reduce((a, s) => a + (set.has(`${s.id}:PROJECT`) ? 0 : 1) + (set.has(`${s.id}:REPORT`) ? 0 : 1), 0) });
  }
  if (has("RESULTS", "FULL_LIFECYCLE")) est.push({ label: "Results to publish", value: eligible.length });
  if (has("COMPLETION", "FULL_LIFECYCLE")) est.push({ label: "Internships to complete", value: eligible.length });
  if (SINGLE_DOC[op]) est.push({ label: `${DOCUMENT_LABEL[SINGLE_DOC[op]!]}s to render`, value: eligible.length });
  if (op === "ZIP") {
    let docs = 0;
    for (const s of eligible.slice(0, MAX_STUDENTS)) {
      const av = await documentAvailability(s.id);
      docs += DOCUMENT_TYPES.filter((t) => av[t].available).length;
    }
    est.push({ label: "Documents to render", value: docs });
  }
  if (op === "FULL_LIFECYCLE") est.push({ label: "Documents to render (up to)", value: eligible.length * DOCUMENT_TYPES.length });

  return {
    operation: op,
    generating: GENERATING_OPS.has(op),
    matched: matched.length,
    eligible: eligible.length,
    excluded,
    unmatchedRegNos: unmatchedRegNos.slice(0, 50),
    overLimit: eligible.length > MAX_STUDENTS,
    sample: eligible.slice(0, 12).map((s) => ({
      id: s.id,
      name: s.name,
      regNo: s.portalRegNo ?? s.registrationNumber,
      college: s.college.name,
      domain: s.domain?.name ?? "—",
      status: s.status,
      start: s.internshipStart ? toISTDateString(s.internshipStart) : null,
    })),
    workingDays,
    estimates: est,
  };
}

// ───────────── Runner ─────────────

type LogLevel = "info" | "warn" | "error";
export interface JobLogEntry {
  at: string;
  level: LogLevel;
  message: string;
}

const registry = ((globalThis as unknown as { __rknBulkRunners?: Map<string, Promise<void>> }).__rknBulkRunners ??= new Map<string, Promise<void>>());

export const isRunnerActive = (jobId: string) => registry.has(jobId);

/** Start processing a job in the background (never awaited by the caller). Safe to call twice. */
export function startBulkJob(jobId: string) {
  if (registry.has(jobId)) return;
  const p = runJob(jobId)
    .catch(async (e) => {
      console.error("[bulk] job crashed", jobId, e);
      const job = await prisma.bulkJob.findUnique({ where: { id: jobId } }).catch(() => null);
      if (job) {
        const log = parseJson<JobLogEntry[]>(job.log, []);
        log.push({ at: new Date().toISOString(), level: "error", message: `Job stopped: ${e instanceof Error ? e.message : String(e)}` });
        await prisma.bulkJob.update({ where: { id: jobId }, data: { status: "FAILED", finishedAt: new Date(), log: JSON.stringify(log.slice(-2000)) } }).catch(() => undefined);
      }
    })
    .finally(() => registry.delete(jobId));
  registry.set(jobId, p);
}

/** Mark QUEUED/RUNNING jobs whose runner is gone (e.g. after a server restart) as FAILED. */
export async function reapStaleJobs() {
  const open = await prisma.bulkJob.findMany({ where: { status: { in: ["QUEUED", "RUNNING"] } }, select: { id: true, log: true, createdAt: true } });
  for (const j of open) {
    if (registry.has(j.id)) continue;
    if (Date.now() - j.createdAt.getTime() < 5_000) continue; // just created — runner is starting
    const log = parseJson<JobLogEntry[]>(j.log, []);
    log.push({ at: new Date().toISOString(), level: "error", message: "The job runner stopped unexpectedly (the server may have restarted). Use Retry to run the job again." });
    await prisma.bulkJob.updateMany({ where: { id: j.id, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "FAILED", finishedAt: new Date(), log: JSON.stringify(log.slice(-2000)) } });
  }
}

export function operationLabel(op: string) {
  return BULK_OPERATIONS.find((o) => o.value === op)?.label ?? op;
}

const safe = (v: string) => v.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 60);
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

async function runJob(jobId: string) {
  const job = await prisma.bulkJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.status !== "QUEUED") return;
  const op = job.type as BulkOperation;
  const filters = bulkFiltersSchema.parse(parseJson(job.filters, {}));
  const options = bulkOptionsSchema.parse(parseJson(job.options, {}));
  const log: JobLogEntry[] = parseJson<JobLogEntry[]>(job.log, []);
  const push = (level: LogLevel, message: string) => log.push({ at: new Date().toISOString(), level, message });

  await prisma.bulkJob.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date() } });
  const { eligible } = await resolveStudents(filters, op);
  if (eligible.length > MAX_STUDENTS) {
    push("error", `${eligible.length} students match — the limit is ${MAX_STUDENTS} per job. Narrow the filters and retry.`);
    await prisma.bulkJob.update({ where: { id: jobId }, data: { status: "FAILED", total: eligible.length, finishedAt: new Date(), log: JSON.stringify(log) } });
    return;
  }
  push("info", `Started ${operationLabel(op)} for ${eligible.length} eligible student(s).`);
  await prisma.bulkJob.update({ where: { id: jobId }, data: { total: eligible.length, log: JSON.stringify(log) } });

  const zip = new JSZip();
  const summary: (string | number)[][] = [["Registration No.", "Student", "College", "Result", "Details"]];
  let processed = 0;
  let failed = 0;
  let cancelled = false;
  let files = 0;

  for (const s of eligible) {
    const current = await prisma.bulkJob.findUnique({ where: { id: jobId }, select: { status: true } });
    if (current?.status === "CANCELLED") {
      cancelled = true;
      push("warn", `Cancelled by an administrator after ${processed} of ${eligible.length} student(s).`);
      break;
    }
    const label = `${s.name} (${s.portalRegNo ?? s.registrationNumber})`;
    try {
      const notes = await processStudent(job, op, s, options, zip);
      files += notes.files;
      push("info", `${label}: ${notes.messages.join("; ") || "nothing to do"}`);
      summary.push([s.portalRegNo ?? s.registrationNumber, s.name, s.college.name, notes.skipped ? "SKIPPED" : "OK", notes.messages.join("; ")]);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      push("error", `${label}: ${msg}`);
      summary.push([s.portalRegNo ?? s.registrationNumber, s.name, s.college.name, "FAILED", msg]);
    }
    processed++;
    await prisma.bulkJob.update({ where: { id: jobId }, data: { processed, failed, log: JSON.stringify(log.slice(-2000)) } });
  }

  // Result ZIP: documents (if any) + a per-student summary.
  zip.file("summary.csv", "﻿" + summary.map((r) => r.map(csvCell).join(",")).join("\r\n"));
  zip.file(
    "README.txt",
    [
      `MSY College ERP — bulk job ${jobId}`,
      `Operation: ${operationLabel(op)}`,
      `Created: ${job.createdAt.toISOString()}`,
      `Reason: ${parseJson<{ reason?: string }>(job.options, {}).reason ?? "—"}`,
      `Students processed: ${processed} of ${eligible.length} (failed: ${failed})`,
      `Documents in this archive: ${files}`,
      "",
      "Records created by bulk automation are flagged as generated (generated = true) and are",
      "shown as system-generated in the portal, so they can always be told apart from real student activity.",
    ].join("\r\n"),
  );
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const stamp = toISTDateString();
  const file = await saveGenerated(bytes, `bulk-${op.toLowerCase().replace(/_/g, "-")}-${stamp}-${jobId.slice(-6)}.zip`, "application/zip", "BULK_RESULT", job.createdById);

  const status = cancelled ? "CANCELLED" : eligible.length > 0 && failed === eligible.length ? "FAILED" : "COMPLETED";
  push(failed ? "warn" : "info", `${status === "COMPLETED" ? "Finished" : status === "CANCELLED" ? "Stopped" : "Failed"}: ${processed - failed} succeeded, ${failed} failed, ${files} document(s) rendered.`);
  await prisma.bulkJob.update({ where: { id: jobId }, data: { status, processed, failed, resultFileId: file.id, finishedAt: new Date(), log: JSON.stringify(log.slice(-2000)) } });
  await audit(job.createdById, "BULK_JOB", "BulkJob", jobId, { operation: "FINISHED", type: op, status, processed, failed, documents: files });
}

interface StudentResult {
  messages: string[];
  files: number;
  skipped?: boolean;
}

async function processStudent(job: BulkJob, op: BulkOperation, s: BulkStudent, o: BulkOptions, zip: JSZip): Promise<StudentResult> {
  const r: StudentResult = { messages: [], files: 0 };
  const has = (...ops: BulkOperation[]) => ops.includes(op);
  const folder = `${safe(s.portalRegNo ?? s.registrationNumber)}_${safe(s.name)}`;

  if (has("ATTENDANCE", "FULL_LIFECYCLE")) r.messages.push(await genAttendance(job, s, o));
  if (has("LOGBOOKS", "FULL_LIFECYCLE")) r.messages.push(await genLogbook(s));
  if (has("LEARNING", "FULL_LIFECYCLE")) r.messages.push(await genLearning(s, o));
  if (has("FULL_LIFECYCLE") && o.generateSubmissions) r.messages.push(await genSubmissions(job, s));
  if (has("ASSESSMENT", "FULL_LIFECYCLE")) r.messages.push(await genAssessment(s));
  if (has("RESULTS", "FULL_LIFECYCLE")) {
    const res = await publishResult(s.id);
    r.messages.push(`result ${res.pass ? "PASS" : "FAIL"} (${res.score}%, grade ${res.grade})${res.pass ? "" : ` — unmet: ${res.progress.eligibility.checks.filter((c) => !c.met).map((c) => c.label).join(", ") || "score below 40%"}`}`);
  }
  if (has("COMPLETION", "FULL_LIFECYCLE")) {
    const res = await completeInternship(s.id);
    r.messages.push(`internship completed (${res === "PASS" ? "certificate issued" : "no certificate — result FAIL"})`);
  }

  const single = SINGLE_DOC[op];
  if (single) {
    if (single === "CERTIFICATE") {
      const cert = await prisma.certificate.findUnique({ where: { studentId: s.id }, select: { revokedAt: true } });
      if (!cert || cert.revokedAt) return { messages: ["skipped — no valid certificate"], files: 0, skipped: true };
    }
    const doc = await renderStudentDocument(s.id, single, { force: true });
    zip.file(doc.filename, doc.bytes);
    r.files++;
    r.messages.push(`${DOCUMENT_LABEL[single]} rendered`);
  }

  if (has("ZIP", "FULL_LIFECYCLE")) {
    const av = await documentAvailability(s.id);
    const done: string[] = [];
    for (const t of DOCUMENT_TYPES) {
      if (!av[t].available) continue;
      const doc = await renderStudentDocument(s.id, t, { force: true });
      zip.file(`${folder}/${doc.filename}`, doc.bytes);
      r.files++;
      done.push(DOCUMENT_LABEL[t]);
    }
    if (o.includeReceipts) {
      const pays = await prisma.payment.findMany({ where: { studentId: s.id, status: "SUCCESS", receiptNo: { not: null } }, select: { id: true } });
      for (const p of pays) {
        const doc = await renderReceipt(p.id);
        zip.file(`${folder}/${doc.filename}`, doc.bytes);
        r.files++;
        done.push("Receipt");
      }
    }
    r.messages.push(done.length ? `${done.length} document(s): ${done.join(", ")}` : "no documents available yet");
  }
  return r;
}

async function genAttendance(job: BulkJob, s: BulkStudent, o: BulkOptions): Promise<string> {
  const days = attendanceWindow(s, o);
  if (!days.length) return "attendance: no working days in range";
  const existing = new Set((await prisma.attendance.findMany({ where: { studentId: s.id, date: { in: days } }, select: { date: true } })).map((a) => a.date));
  const missing = days.filter((d) => !existing.has(d));
  if (!missing.length) return `attendance: all ${days.length} working day(s) already marked`;
  const data = missing.map((date, i) => {
    const status = statusFor(i, o.presentRatio);
    return {
      studentId: s.id,
      date,
      status,
      checkIn: status === "PRESENT" ? new Date(`${date}T10:00:00+05:30`) : null,
      checkOut: status === "PRESENT" ? new Date(`${date}T16:00:00+05:30`) : null,
      learningSeconds: 0,
      remarks: "Generated by bulk automation",
      generated: true,
      markedById: job.createdById,
    };
  });
  await prisma.attendance.createMany({ data });
  const present = data.filter((d) => d.status === "PRESENT").length;
  return `attendance: ${data.length} row(s) created (${present} present${data.length - present ? `, ${data.length - present} absent` : ""})`;
}

async function genLogbook(s: BulkStudent): Promise<string> {
  const days = logbookWindow(s);
  const entries = await prisma.logbookEntry.findMany({ where: { studentId: s.id }, select: { date: true, hours: true } });
  const have = new Set(entries.map((e) => e.date));
  const hours = entries.reduce((a, e) => a + e.hours, 0);
  const target = s.domain?.durationHours ?? 120;
  const free = days.filter((d) => !have.has(d));
  const plan = planLogbookHours(free.length, Math.max(0, target - hours));
  if (!plan.length) return hours >= target ? `logbook: already ${Math.round(hours)}h of ${target}h` : "logbook: no free working days";
  const chapters = await prisma.chapter.findMany({
    where: { module: { domainId: s.domainId! } },
    orderBy: [{ module: { number: "asc" } }, { number: "asc" }],
    select: { name: true, module: { select: { name: true } } },
  });
  const data = plan.map((h, i) => {
    const c = chapters.length ? chapters[Math.floor((i * chapters.length) / plan.length)] : null;
    return {
      studentId: s.id,
      date: free[i]!,
      hours: h,
      activity: c ? `Studied "${c.name}" (${c.module.name}) and completed the related practice exercises.` : `Worked on ${s.domain?.name ?? "internship"} learning modules and practice tasks.`,
      skills: c ? c.name : s.domain?.name ?? "Domain skills",
      generated: true,
    };
  });
  await prisma.logbookEntry.createMany({ data });
  const added = plan.reduce((a, b) => a + b, 0);
  return `logbook: ${data.length} entr${data.length === 1 ? "y" : "ies"} (${added}h) created, total ${Math.round((hours + added) * 10) / 10}h of ${target}h`;
}

async function genLearning(s: BulkStudent, o: BulkOptions): Promise<string> {
  const chapters = await prisma.chapter.findMany({
    where: { module: { domainId: s.domainId! } },
    orderBy: [{ module: { number: "asc" } }, { number: "asc" }],
    select: { id: true, quiz: { select: { id: true, questions: { select: { id: true, correctIndex: true, marks: true }, orderBy: { sort: "asc" } } } } },
  });
  if (!chapters.length) return "learning: domain has no chapters";
  const [done, passed] = await Promise.all([
    prisma.chapterProgress.findMany({ where: { studentId: s.id, completed: true }, select: { chapterId: true } }),
    prisma.quizAttempt.findMany({ where: { studentId: s.id, passed: true }, select: { quizId: true } }),
  ]);
  const doneSet = new Set(done.map((d) => d.chapterId));
  const passSet = new Set(passed.map((p) => p.quizId));
  let completed = 0;
  let quizzes = 0;
  for (const c of chapters) {
    if (o.includeQuizzes && c.quiz && !passSet.has(c.quiz.id)) {
      const qs = c.quiz.questions;
      const max = qs.reduce((a, q) => a + q.marks, 0);
      const now = new Date();
      await prisma.quizAttempt.create({
        data: {
          quizId: c.quiz.id,
          studentId: s.id,
          startedAt: new Date(now.getTime() - 10 * 60_000),
          submittedAt: now,
          questionOrder: JSON.stringify(qs.map((q) => q.id)),
          answers: JSON.stringify(Object.fromEntries(qs.map((q) => [q.id, q.correctIndex]))),
          score: max,
          maxScore: max,
          percent: 100,
          passed: true,
          generated: true,
        },
      });
      quizzes++;
    }
    if (!doneSet.has(c.id)) {
      await markChapterComplete(s.id, c.id, "BULK");
      completed++;
    }
  }
  return `learning: ${completed} chapter(s) completed${o.includeQuizzes ? `, ${quizzes} quiz pass record(s) created` : ""}`;
}

async function genSubmissions(job: BulkJob, s: BulkStudent): Promise<string> {
  const subs = await prisma.submission.findMany({ where: { studentId: s.id, kind: { in: ["PROJECT", "REPORT"] } }, orderBy: { updatedAt: "desc" } });
  const out: string[] = [];
  for (const kind of ["PROJECT", "REPORT"] as const) {
    const latest = subs.find((x) => x.kind === kind);
    if (latest?.status === "APPROVED") continue;
    if (latest) {
      await prisma.submission.update({ where: { id: latest.id }, data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: job.createdById, feedback: latest.feedback ?? "Approved by bulk automation" } });
      out.push(`${kind.toLowerCase()} approved`);
    } else {
      await prisma.submission.create({
        data: {
          studentId: s.id,
          kind,
          title: kind === "PROJECT" ? `${s.domain?.name ?? "Internship"} live project` : "Internship report",
          description: "Generated by bulk automation",
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedById: job.createdById,
          feedback: "Generated and approved by bulk automation",
          generated: true,
        },
      });
      out.push(`${kind.toLowerCase()} record created`);
    }
  }
  return out.length ? `submissions: ${out.join(", ")}` : "submissions: project and report already approved";
}

async function genAssessment(s: BulkStudent): Promise<string> {
  const existing = await prisma.assessment.findUnique({ where: { studentId: s.id }, select: { id: true } });
  if (existing) return "assessment: already submitted";
  const ratings = Object.fromEntries(ASSESSMENT_CRITERIA.map((c) => [c.key, "GOOD"]));
  await prisma.assessment.create({
    data: {
      studentId: s.id,
      mentorId: s.mentorId,
      ratings: JSON.stringify(ratings),
      remarks: "Generated by bulk automation",
      recommendCertificate: true,
      score: assessmentScore(ratings),
      generated: true,
    },
  });
  return "assessment: created (Good, certificate recommended)";
}

// ───────────── Job creation ─────────────

export async function createBulkJob(input: { type: BulkOperation; filters: BulkFilters; options: BulkOptions; reason: string | null; actorId: string; retryOfId?: string | null }) {
  const { eligible } = await resolveStudents(input.filters, input.type);
  if (eligible.length === 0) throw new ApiError(422, "No eligible students match these filters.");
  if (eligible.length > MAX_STUDENTS) throw new ApiError(422, `${eligible.length} students match. A job can process at most ${MAX_STUDENTS}; narrow the filters.`);
  const job = await prisma.bulkJob.create({
    data: {
      type: input.type,
      filters: JSON.stringify(input.filters),
      options: JSON.stringify({ ...input.options, reason: input.reason }),
      status: "QUEUED",
      total: eligible.length,
      createdById: input.actorId,
      retryOfId: input.retryOfId ?? null,
      log: JSON.stringify([{ at: new Date().toISOString(), level: "info", message: input.retryOfId ? `Retry of job ${input.retryOfId} queued.` : "Job queued." }]),
    },
  });
  startBulkJob(job.id);
  return job;
}
