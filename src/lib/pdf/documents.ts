// Student document generation (FR-STU-11, WF-4) and payment receipts.
// Documents are rendered on demand from live data, so they always reflect the current record.
import "server-only";
import QRCode from "qrcode";
import { rgb } from "pdf-lib";
import { prisma } from "../db";
import { ApiError } from "../http";
import { ASSESSMENT_CRITERIA, ATTENDANCE_LABEL, DOCUMENT_LABEL, ORG, RATINGS, type DocumentType } from "../constants";
import { formatDate, formatINR, formatTime, toISTDateString, workingDaysBetween } from "../format";
import { accessState, attendanceStats, learningTree, parseRatings, studentProgress } from "../student";
import { COLORS, PdfKit, clean } from "./kit";
import { appUrl } from "../payments";

export interface RenderedFile {
  bytes: Uint8Array;
  filename: string;
  mime: string;
}

const loadStudent = (id: string) =>
  prisma.student.findUnique({
    where: { id },
    include: { college: true, domain: { include: { sector: true } }, mentor: true, assessment: true, certificate: true },
  });
type FullStudent = NonNullable<Awaited<ReturnType<typeof loadStudent>>>;

export type Availability = Record<DocumentType, { available: boolean; reason?: string }>;

export async function documentAvailability(studentId: string): Promise<Availability> {
  const s = await loadStudent(studentId);
  if (!s) throw new ApiError(404, "Student not found");
  const [logCount, report] = await Promise.all([
    prisma.logbookEntry.count({ where: { studentId } }),
    prisma.submission.findFirst({ where: { studentId, kind: "REPORT" }, orderBy: { updatedAt: "desc" } }),
  ]);
  const state = accessState(s);
  const paidStarted = s.paymentStatus === "PAID" && Boolean(s.internshipStart);
  const started = state === "ACTIVE" || state === "COMPLETED";
  const no = (reason: string) => ({ available: false, reason });
  const yes = { available: true };
  return {
    OFFER_LETTER: paidStarted ? yes : no("Available once your internship start date is set"),
    ACCEPTANCE_LETTER: paidStarted ? yes : no("Available once your internship start date is set"),
    ATTENDANCE_SHEET: started ? yes : no("Available after your internship starts"),
    LOGBOOK: logCount > 0 ? yes : no("Add at least one logbook entry"),
    REPORT: report?.status === "APPROVED" || s.status === "COMPLETED" ? yes : no("Available after your internship report is approved"),
    MARKSHEET: s.resultPublishedAt ? yes : no("Available after results are published"),
    CERTIFICATE: s.certificate && !s.certificate.revokedAt ? yes : no("Available after successful completion"),
  };
}

function fileBase(s: FullStudent, label: string) {
  return `${label.replace(/\s+/g, "_")}_${(s.portalRegNo ?? s.registrationNumber).replace(/[^\w-]/g, "")}.pdf`;
}

export async function renderStudentDocument(studentId: string, type: DocumentType, opts: { force?: boolean } = {}): Promise<RenderedFile> {
  const s = await loadStudent(studentId);
  if (!s) throw new ApiError(404, "Student not found");
  if (!opts.force) {
    const av = (await documentAvailability(studentId))[type];
    if (!av.available) throw new ApiError(409, av.reason ?? "Document not available yet");
  }
  const bytes = await RENDERERS[type](s);
  return { bytes, filename: fileBase(s, DOCUMENT_LABEL[type]), mime: "application/pdf" };
}

const RENDERERS: Record<DocumentType, (s: FullStudent) => Promise<Uint8Array>> = {
  OFFER_LETTER: offerLetter,
  ACCEPTANCE_LETTER: acceptanceLetter,
  ATTENDANCE_SHEET: attendanceSheet,
  LOGBOOK: logbook,
  REPORT: internshipReport,
  MARKSHEET: marksheet,
  CERTIFICATE: certificate,
};

function studentBlock(k: PdfKit, s: FullStudent) {
  k.keyValues([
    ["Student name", s.name],
    ["MSY College Reg. No.", s.portalRegNo],
    ["University Reg. No.", s.registrationNumber],
    ["Programme / Major", [s.programme, s.majorSubject].filter(Boolean).join(" — ")],
    ["College", s.college.name],
    ["University", s.college.university],
    ["Internship domain", s.domain?.name],
    ["Session / Semester", `${s.session ?? "—"} / Sem ${s.semester ?? "—"}`],
  ]);
}

async function offerLetter(s: FullStudent) {
  const k = await PdfKit.create({ title: "Offer Letter" });
  k.letterhead();
  k.text(`Ref: MSY/OL/${s.portalRegNo ?? s.studentCode}`, { size: 9.5, color: COLORS.muted });
  k.text(`Date: ${formatDate(s.internshipStart ?? new Date())}`, { size: 9.5, color: COLORS.muted });
  k.space(12);
  k.text("INTERNSHIP OFFER LETTER", { size: 15, font: "bold", color: COLORS.brand, align: "center" });
  k.space(12);
  k.text(`Dear ${s.name},`, { font: "bold" });
  k.space(4);
  k.text(
    `We are pleased to offer you an internship in ${s.domain?.name ?? "the selected domain"} with ${ORG.name} under the National Education Policy (NEP) 2020 / CBCS framework. ` +
      `This internship carries 4 academic credits on successful completion of about ${s.domain?.durationHours ?? 120} hours of structured learning, live project work and evaluation.`,
    { lineGap: 2 },
  );
  k.space(8);
  k.keyValues([
    ["Internship start date", formatDate(s.internshipStart)],
    ["Expected completion", formatDate(s.internshipEnd)],
    ["Duration", `${s.domain?.durationHours ?? 120} hours`],
    ["Mode", "Online (self-paced learning + live classes)"],
    ["Mentor", s.mentor?.name ?? "To be allocated"],
    ["Credits", "4 (NEP 2020 / CBCS)"],
  ]);
  k.text("During the internship you are expected to:", { font: "bold" });
  for (const line of [
    "Mark daily attendance (check-in / check-out) on the student portal.",
    "Complete all learning modules, chapter quizzes and assignments in sequence.",
    "Maintain a daily digital logbook with hours worked and skills learned.",
    "Submit a live project and a signed internship report for mentor review.",
  ])
    k.text(`•  ${line}`, { x: k.margin + 10, lineGap: 1 });
  k.space(8);
  k.text("A QR-verified internship certificate and assessment marksheet will be issued on successful completion as per programme rules.", { lineGap: 2 });
  k.space(6);
  k.text("We wish you a rewarding learning experience.");
  k.signatures(["Authorised Signatory, MSY College", "Student Signature"]);
  studentFooter(k, s);
  return k.save();
}

async function acceptanceLetter(s: FullStudent) {
  const k = await PdfKit.create({ title: "Acceptance Letter" });
  k.letterhead("Internship Acceptance Letter");
  k.text(`Date: ${formatDate(s.internshipStart ?? new Date())}`, { size: 9.5, color: COLORS.muted, align: "right" });
  k.space(8);
  k.text("To,", {});
  k.text(`The Principal / Internship Coordinator`, {});
  k.text(`${s.college.name}${s.college.district ? ", " + s.college.district : ""}`, {});
  k.space(10);
  k.text(`Subject: Acceptance of internship — ${s.name} (${s.registrationNumber})`, { font: "bold" });
  k.space(8);
  k.text(
    `This is to confirm that ${s.name}, ${s.gender === "FEMALE" ? "daughter" : s.gender === "MALE" ? "son" : "child"} of ${s.fatherName ?? "—"}, a student of ${s.programme ?? "the UG programme"} ` +
      `(${s.majorSubject ?? "—"}), Session ${s.session ?? "—"}, Semester ${s.semester ?? "—"}, has been accepted for an internship in ${s.domain?.name ?? "—"} with ${ORG.name}.`,
    { lineGap: 2 },
  );
  k.space(6);
  k.text(
    `The internship begins on ${formatDate(s.internshipStart)} and is expected to conclude by ${formatDate(s.internshipEnd)}, covering about ${s.domain?.durationHours ?? 120} hours ` +
      `as required for 4 credits under NEP 2020 / CBCS. Attendance, logbook, assessment and certificate records will be shared with the college through the MSY College partner-college portal.`,
    { lineGap: 2 },
  );
  k.space(10);
  studentBlock(k, s);
  k.signatures(["Authorised Signatory, MSY College", "College Coordinator"]);
  studentFooter(k, s);
  return k.save();
}

async function attendanceSheet(s: FullStudent) {
  const k = await PdfKit.create({ title: "Attendance Sheet" });
  k.letterhead("Attendance Sheet");
  k.setRunningHeader(`Attendance Sheet — ${s.name}`);
  studentBlock(k, s);
  const rows = await prisma.attendance.findMany({ where: { studentId: s.id }, orderBy: { date: "asc" } });
  const stats = await attendanceStats(s.id, s.internshipStart, s.internshipEnd, { rows });
  k.keyValues(
    [
      ["Working days", stats.workingDays],
      ["Present", stats.present],
      ["Half day", stats.halfDay],
      ["Absent", stats.absent],
      ["Approved leave", stats.leave],
      ["Attendance", `${stats.percent}%`],
    ],
    3,
  );
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const start = s.internshipStart ? toISTDateString(s.internshipStart) : null;
  const today = toISTDateString();
  const end = s.internshipEnd ? toISTDateString(s.internshipEnd) : today;
  const days = start ? workingDaysBetween(start, end < today ? end : today) : [];
  let i = 0;
  k.table(
    [
      { header: "#", width: 0.06, align: "center" },
      { header: "Date", width: 0.18 },
      { header: "Day", width: 0.12 },
      { header: "Check in", width: 0.14 },
      { header: "Check out", width: 0.14 },
      { header: "Status", width: 0.16 },
      { header: "Remarks", width: 0.2 },
    ],
    days.map((d) => {
      const r = byDate.get(d);
      const status = r ? ATTENDANCE_LABEL[r.status as keyof typeof ATTENDANCE_LABEL] : d === today ? "Not Marked" : "Absent";
      return [++i, formatDate(d), new Date(d + "T12:00:00+05:30").toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }), r?.checkIn ? formatTime(r.checkIn) : "—", r?.checkOut ? formatTime(r.checkOut) : "—", status, r?.remarks ?? ""];
    }),
  );
  k.signatures(["Mentor", "Authorised Signatory, MSY College"]);
  return k.save();
}

async function logbook(s: FullStudent) {
  const k = await PdfKit.create({ title: "Digital Logbook" });
  k.letterhead("Digital Logbook");
  k.setRunningHeader(`Digital Logbook — ${s.name}`);
  studentBlock(k, s);
  const entries = await prisma.logbookEntry.findMany({ where: { studentId: s.id }, orderBy: { date: "asc" } });
  const hours = entries.reduce((a, e) => a + e.hours, 0);
  k.keyValues([["Entries", entries.length], ["Total hours", `${Math.round(hours * 10) / 10} / ${s.domain?.durationHours ?? 120}`]], 2);
  k.table(
    [
      { header: "Date", width: 0.15 },
      { header: "Hours", width: 0.08, align: "center" },
      { header: "Work done / activity", width: 0.47 },
      { header: "Skills learned", width: 0.3 },
    ],
    entries.map((e) => [formatDate(e.date), e.hours, e.activity, e.skills]),
  );
  k.signatures(["Student", "Mentor"]);
  return k.save();
}

async function internshipReport(s: FullStudent) {
  const k = await PdfKit.create({ title: "Internship Report" });
  k.letterhead("Internship Report");
  k.setRunningHeader(`Internship Report — ${s.name}`);
  studentBlock(k, s);
  const [p, tree, subs] = await Promise.all([
    studentProgress(s.id),
    learningTree(s.id, s.domainId),
    prisma.submission.findMany({ where: { studentId: s.id }, include: { assignment: true }, orderBy: { submittedAt: "asc" } }),
  ]);
  k.text("1. Internship summary", { size: 12, font: "bold", color: COLORS.brand });
  k.keyValues(
    [
      ["Period", `${formatDate(s.internshipStart)} – ${formatDate(s.internshipEnd)}`],
      ["Mentor", s.mentor?.name],
      ["Internship hours (logbook)", `${p.loggedHours} h`],
      ["Active learning time", `${p.learningHours} h`],
      ["Attendance", `${p.attendance.percent}%`],
      ["Chapters completed", `${p.learning.completed} / ${p.learning.total}`],
    ],
    3,
  );
  k.text("2. Learning modules covered", { size: 12, font: "bold", color: COLORS.brand });
  k.table(
    [
      { header: "Module", width: 0.45 },
      { header: "Chapters", width: 0.2, align: "center" },
      { header: "Completed", width: 0.15, align: "center" },
      { header: "Status", width: 0.2 },
    ],
    tree.modules.map((m) => [`${m.number}. ${m.name}`, m.chapters.length, m.completed, m.completed === m.chapters.length ? "Completed" : "In progress"]),
  );
  k.text("3. Assignments, live project and report", { size: 12, font: "bold", color: COLORS.brand });
  k.table(
    [
      { header: "Type", width: 0.15 },
      { header: "Title", width: 0.4 },
      { header: "Status", width: 0.2 },
      { header: "Marks", width: 0.1, align: "center" },
      { header: "Submitted", width: 0.15 },
    ],
    subs.map((x) => [x.kind[0] + x.kind.slice(1).toLowerCase(), x.assignment?.title ?? x.title ?? "—", x.status === "APPROVED" ? "Approved" : x.status === "PENDING" ? "Pending review" : "Resubmission", x.marks ?? "—", formatDate(x.submittedAt)]),
  );
  if (s.assessment) {
    k.text("4. Mentor remarks", { size: 12, font: "bold", color: COLORS.brand });
    k.text(s.assessment.remarks || "—", { lineGap: 2 });
  }
  k.signatures(["Student", "Mentor", "Authorised Signatory"]);
  return k.save();
}

async function marksheet(s: FullStudent) {
  const k = await PdfKit.create({ title: "Assessment Marksheet" });
  k.letterhead("Assessment Marksheet");
  studentBlock(k, s);
  const p = await studentProgress(s.id);
  const ratings = parseRatings(s.assessment?.ratings);
  k.text("Mentor assessment", { size: 12, font: "bold", color: COLORS.brand });
  k.table(
    [
      { header: "Criterion", width: 0.55 },
      { header: "Rating", width: 0.3 },
      { header: "Score", width: 0.15, align: "center" },
    ],
    ASSESSMENT_CRITERIA.map((c) => {
      const r = RATINGS.find((x) => x.value === ratings[c.key]);
      return [c.label, r?.label ?? "—", r ? r.score : "—"];
    }),
  );
  k.text("Result computation", { size: 12, font: "bold", color: COLORS.brand });
  const score = Math.round((p.quizzes.average * 0.4 + p.assessment.score * 0.4 + p.attendance.percent * 0.2) * 10) / 10;
  k.table(
    [
      { header: "Component", width: 0.5 },
      { header: "Weight", width: 0.2, align: "center" },
      { header: "Score (%)", width: 0.3, align: "center" },
    ],
    [
      ["Chapter quizzes (average best attempt)", "40%", p.quizzes.average],
      ["Mentor assessment", "40%", p.assessment.score],
      ["Attendance", "20%", p.attendance.percent],
      ["Final score", "100%", score],
    ],
  );
  k.ensure(70);
  const boxY = k.y - 56;
  k.page.drawRectangle({ x: k.margin, y: boxY, width: k.contentW, height: 52, color: COLORS.brandLight, borderColor: COLORS.brand, borderWidth: 0.8 });
  k.at("RESULT", k.margin + 16, boxY + 32, { size: 8, font: "bold", color: COLORS.muted });
  k.at(s.resultStatus === "PASS" ? "PASS" : s.resultStatus ?? "—", k.margin + 16, boxY + 12, { size: 16, font: "bold", color: s.resultStatus === "PASS" ? COLORS.green : rgb(0.7, 0.1, 0.1) });
  k.at("GRADE", k.margin + 180, boxY + 32, { size: 8, font: "bold", color: COLORS.muted });
  k.at(s.grade ?? "—", k.margin + 180, boxY + 12, { size: 16, font: "bold", color: COLORS.brand });
  k.at("CREDITS", k.margin + 320, boxY + 32, { size: 8, font: "bold", color: COLORS.muted });
  k.at(s.resultStatus === "PASS" ? "4" : "0", k.margin + 320, boxY + 12, { size: 16, font: "bold" });
  k.y = boxY - 12;
  if (s.assessment?.remarks) {
    k.text("Supervisor remarks", { size: 10, font: "bold" });
    k.text(s.assessment.remarks, { lineGap: 2 });
  }
  k.text(`Published on ${formatDate(s.resultPublishedAt)}. Grades: O ≥ 90, A+ ≥ 80, A ≥ 70, B+ ≥ 60, B ≥ 50, C ≥ 40.`, { size: 8.5, color: COLORS.muted });
  k.signatures(["Mentor", "Controller of Examinations, MSY College"]);
  return k.save();
}

export function verifyUrl(code: string) {
  return `${appUrl()}/verify/${code}`;
}

async function certificate(s: FullStudent) {
  if (!s.certificate) throw new ApiError(409, "Certificate not issued yet");
  const k = await PdfKit.create({ landscape: true, title: "Internship Certificate" });
  const { page } = k;
  const W = k.pageW;
  const H = k.pageH;
  // Borders
  page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, borderColor: COLORS.brand, borderWidth: 3 });
  page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: COLORS.gold, borderWidth: 1 });
  page.drawRectangle({ x: 28, y: H - 110, width: W - 56, height: 82, color: COLORS.brand });
  k.at(ORG.brand.toUpperCase(), 0, H - 70, { size: 26, font: "bold", color: COLORS.white, width: W, align: "center" });
  k.at("NEP 2020 / CBCS Internship Programme  •  MSME Registered  •  ISO 9001:2015", 0, H - 92, { size: 9, color: rgb(0.85, 0.86, 1), width: W, align: "center" });

  k.at("CERTIFICATE OF INTERNSHIP", 0, H - 160, { size: 24, font: "bold", color: COLORS.gold, width: W, align: "center" });
  k.at("This is to certify that", 0, H - 192, { size: 12, font: "italic", color: COLORS.muted, width: W, align: "center" });
  k.at(s.name, 0, H - 226, { size: 28, font: "bold", color: COLORS.ink, width: W, align: "center" });
  page.drawLine({ start: { x: W / 2 - 180, y: H - 234 }, end: { x: W / 2 + 180, y: H - 234 }, thickness: 0.8, color: COLORS.gold });

  const para =
    `${s.fatherName ? `${s.gender === "FEMALE" ? "daughter" : s.gender === "MALE" ? "son" : "child"} of ${s.fatherName}, ` : ""}a student of ${s.programme ?? "UG"} (${s.majorSubject ?? "—"}), ${s.college.name}, ${s.college.university}, ` +
    `University Reg. No. ${s.registrationNumber}, has successfully completed a ${s.domain?.durationHours ?? 120}-hour internship in ${s.domain?.name ?? "—"} ` +
    `from ${formatDate(s.internshipStart)} to ${formatDate(s.internshipEnd ?? s.completedAt)} under the NEP 2020 / CBCS framework and is awarded 4 credits with Grade ${s.grade ?? "—"}.`;
  const lines = k.wrap(para, k.font, 12, W - 260);
  let y = H - 268;
  for (const ln of lines) {
    k.at(ln, 0, y, { size: 12, width: W, align: "center" });
    y -= 18;
  }

  // QR code
  const url = verifyUrl(s.certificate.verifyCode);
  const png = await QRCode.toBuffer(url, { type: "png", margin: 1, width: 360, errorCorrectionLevel: "M" });
  const qr = await k.doc.embedPng(png);
  const q = 92;
  page.drawImage(qr, { x: 60, y: 60, width: q, height: q });
  k.at("Scan to verify", 60, 50, { size: 8, color: COLORS.muted, width: q, align: "center" });
  k.at(`Certificate No: ${s.certificate.certificateNo}`, 164, 124, { size: 9.5, font: "bold" });
  k.at(`MSY College Reg. No: ${s.portalRegNo ?? "—"}`, 164, 110, { size: 9, color: COLORS.muted });
  k.at(`Issued on: ${formatDate(s.certificate.issuedAt)}`, 164, 96, { size: 9, color: COLORS.muted });
  k.at(`Verify: ${url}`, 164, 82, { size: 8, color: COLORS.brand });

  const sig = (label: string, name: string, x: number) => {
    page.drawLine({ start: { x, y: 100 }, end: { x: x + 170, y: 100 }, thickness: 0.8, color: COLORS.muted });
    k.at(name, x, 86, { size: 9.5, font: "bold", width: 170, align: "center" });
    k.at(label, x, 73, { size: 8.5, color: COLORS.muted, width: 170, align: "center" });
  };
  sig("Mentor", s.mentor?.name ?? "—", W - 430);
  sig("Director, MSY College", "Authorised Signatory", W - 230);
  return k.doc.save();
}

function studentFooter(k: PdfKit, s: FullStudent) {
  k.space(4);
  k.text(`Student: ${s.name}  •  Reg. No. ${s.registrationNumber}  •  ${s.college.name}`, { size: 8.5, color: COLORS.muted });
}

// ───────────── Receipt ─────────────

export async function renderReceipt(paymentId: string): Promise<RenderedFile> {
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { student: { include: { college: true, domain: true } } } });
  if (!p) throw new ApiError(404, "Payment not found");
  if (p.status !== "SUCCESS" || !p.receiptNo) throw new ApiError(409, "Receipt is available only for successful payments");
  const s = p.student;
  const k = await PdfKit.create({ title: "Payment Receipt" });
  k.letterhead("Payment Receipt");
  k.keyValues(
    [
      ["Receipt number", p.receiptNo],
      ["Receipt date", formatDate(p.paidAt)],
      ["Transaction ID", p.transactionId],
      ["Gateway", p.gateway === "SANDBOX" ? "Sandbox (test)" : p.gateway[0] + p.gateway.slice(1).toLowerCase()],
      ["Gateway order ID", p.orderId],
      ["Gateway payment ID", p.gatewayPaymentId],
      ["Payment method", (p.method ?? "—").toUpperCase()],
      ["Status", "PAID"],
    ],
    2,
  );
  k.rule();
  k.keyValues(
    [
      ["Received from", s.name],
      ["MSY College Reg. No.", s.portalRegNo],
      ["University Reg. No.", s.registrationNumber],
      ["College", s.college.name],
      ["Mobile", s.mobile],
      ["Email", s.email],
    ],
    2,
  );
  k.table(
    [
      { header: "Description", width: 0.7 },
      { header: "Amount", width: 0.3, align: "right" },
    ],
    [
      [`Internship fee — ${s.domain?.name ?? "Internship"} (${s.domain?.durationHours ?? 120} hours, certificate included)`, clean(formatINR(p.amount, { decimals: true }))],
      ["Total paid", clean(formatINR(p.amount, { decimals: true }))],
    ],
    { size: 10 },
  );
  k.text("This is a computer-generated receipt and does not require a signature.", { size: 8.5, color: COLORS.muted });
  if (p.manualReason) k.text(`Recorded manually by MSY College accounts. Note: ${p.manualReason}`, { size: 8.5, color: COLORS.muted });
  k.text(`For support, contact ${ORG.email} or ${ORG.phone} quoting the transaction ID.`, { size: 8.5, color: COLORS.muted });
  return { bytes: await k.save(), filename: `Receipt_${p.receiptNo.replace(/\//g, "-")}.pdf`, mime: "application/pdf" };
}
