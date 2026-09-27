// Student lifecycle logic shared by every portal and by bulk automation:
// access state (FR-STU-2), attendance statistics, sequential learning (WF-2),
// progress summary (FR-STU-1), certificate eligibility, results and completion (WF-4).
import "server-only";
import { prisma } from "./db";
import type { AccessState } from "./constants";
import { RATINGS } from "./constants";
import { istDate, pct, toISTDateString, workingDaysBetween } from "./format";
import { parseJson } from "./json";
import { getEligibilityRules } from "./settings";
import { newCertificateNo, newVerifyCode } from "./ids";

type StateInput = { status: string; paymentStatus: string; internshipStart: Date | null };

export function accessState(s: StateInput): AccessState {
  if (s.status === "BLOCKED") return "BLOCKED";
  if (s.status === "COMPLETED") return "COMPLETED";
  if (!s.internshipStart || s.paymentStatus !== "PAID") return "WAITING";
  if (toISTDateString(s.internshipStart) > toISTDateString()) return "NOT_STARTED";
  return "ACTIVE";
}

export const ACCESS_STATE_LABEL: Record<AccessState, string> = {
  WAITING: "Waiting to Start",
  NOT_STARTED: "Not Started",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
};

// ───────────── Attendance ─────────────

export interface AttendanceStats {
  workingDays: number; // elapsed working days (Mon–Sat) in the window up to today
  totalDays: number; // working days in the whole window
  present: number;
  halfDay: number;
  absent: number;
  leave: number;
  notMarked: number;
  percent: number;
}

export async function attendanceStats(
  studentId: string,
  start: Date | null,
  end: Date | null,
  opts: { rows?: { date: string; status: string }[] } = {},
): Promise<AttendanceStats> {
  const empty: AttendanceStats = { workingDays: 0, totalDays: 0, present: 0, halfDay: 0, absent: 0, leave: 0, notMarked: 0, percent: 0 };
  if (!start) return empty;
  const from = toISTDateString(start);
  const today = toISTDateString();
  const endYmd = end ? toISTDateString(end) : today;
  const upTo = endYmd < today ? endYmd : today;
  const elapsed = workingDaysBetween(from, upTo);
  const total = workingDaysBetween(from, endYmd).length;
  const rows = opts.rows ?? (await prisma.attendance.findMany({ where: { studentId }, select: { date: true, status: true } }));
  const byDate = new Map(rows.map((r) => [r.date, r.status]));
  const st = { ...empty, workingDays: elapsed.length, totalDays: total };
  for (const d of elapsed) {
    const s = byDate.get(d);
    if (s === "PRESENT") st.present++;
    else if (s === "HALF_DAY") st.halfDay++;
    else if (s === "ABSENT") st.absent++;
    else if (s === "LEAVE") st.leave++;
    else if (d !== today) st.notMarked++; // today may still be marked
  }
  // Sundays or out-of-window rows still count if the student marked them
  const denom = st.workingDays - st.leave - (byDate.has(today) ? 0 : elapsed.includes(today) ? 1 : 0);
  st.percent = denom > 0 ? Math.min(100, pct(st.present + st.halfDay * 0.5, denom)) : 0;
  return st;
}

// ───────────── Learning ─────────────

export interface QuizInfo {
  id: string;
  title: string;
  passingScore: number;
  attemptsAllowed: number;
  extraAttempts: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  bestPercent: number | null;
  passed: boolean;
  openAttemptId: string | null; // in-progress, not expired
  timeLimitMinutes: number | null;
  questionCount: number;
}

export interface ChapterNode {
  id: string;
  number: number;
  name: string;
  description: string | null;
  moduleId: string;
  minWatchSeconds: number;
  minReadSeconds: number;
  watchSeconds: number;
  readSeconds: number;
  requirementsMet: boolean;
  completed: boolean;
  completedVia: string | null;
  unlocked: boolean;
  resourceCount: number;
  quiz: QuizInfo | null;
}

export interface ModuleNode {
  id: string;
  number: number;
  name: string;
  description: string | null;
  chapters: ChapterNode[];
  completed: number;
  unlocked: boolean;
}

export async function quizAttemptInfo(quizId: string, studentId: string): Promise<QuizInfo | null> {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { _count: { select: { questions: true } } } });
  if (!quiz) return null;
  const [attempts, grants] = await Promise.all([
    prisma.quizAttempt.findMany({ where: { quizId, studentId } }),
    prisma.quizReattemptGrant.findMany({ where: { quizId, studentId } }),
  ]);
  return buildQuizInfo(quiz, quiz._count.questions, attempts, grants);
}

function buildQuizInfo(
  quiz: { id: string; title: string; passingScore: number; attemptsAllowed: number; timeLimitMinutes: number | null },
  questionCount: number,
  attempts: { id: string; submittedAt: Date | null; expiresAt: Date | null; percent: number; passed: boolean }[],
  grants: { extraAttempts: number }[],
): QuizInfo {
  const now = new Date();
  const submitted = attempts.filter((a) => a.submittedAt);
  const open = attempts.find((a) => !a.submittedAt && (!a.expiresAt || a.expiresAt > now));
  // Expired, unsubmitted attempts count as used.
  const used = attempts.filter((a) => a.submittedAt || (a.expiresAt && a.expiresAt <= now)).length;
  const extra = grants.reduce((s, g) => s + g.extraAttempts, 0);
  const best = submitted.length ? Math.max(...submitted.map((a) => a.percent)) : null;
  return {
    id: quiz.id,
    title: quiz.title,
    passingScore: quiz.passingScore,
    attemptsAllowed: quiz.attemptsAllowed,
    extraAttempts: extra,
    attemptsUsed: used,
    attemptsRemaining: Math.max(0, quiz.attemptsAllowed + extra - used - (open ? 1 : 0)),
    bestPercent: best,
    passed: submitted.some((a) => a.passed),
    openAttemptId: open?.id ?? null,
    timeLimitMinutes: quiz.timeLimitMinutes,
    questionCount,
  };
}

/** Full learning tree for a student with sequential unlock state (WF-2). */
export async function learningTree(studentId: string, domainId: string | null): Promise<{ modules: ModuleNode[]; total: number; completed: number; percent: number }> {
  if (!domainId) return { modules: [], total: 0, completed: 0, percent: 0 };
  const [modules, progress, attempts, grants] = await Promise.all([
    prisma.module.findMany({
      where: { domainId },
      orderBy: { number: "asc" },
      include: {
        chapters: {
          orderBy: { number: "asc" },
          include: { quiz: { include: { _count: { select: { questions: true } } } }, _count: { select: { resources: true } } },
        },
      },
    }),
    prisma.chapterProgress.findMany({ where: { studentId } }),
    prisma.quizAttempt.findMany({ where: { studentId }, select: { id: true, quizId: true, submittedAt: true, expiresAt: true, percent: true, passed: true } }),
    prisma.quizReattemptGrant.findMany({ where: { studentId }, select: { quizId: true, extraAttempts: true } }),
  ]);
  const pMap = new Map(progress.map((p) => [p.chapterId, p]));
  let prevComplete = true;
  let total = 0;
  let done = 0;
  const out: ModuleNode[] = modules.map((m) => {
    const moduleUnlocked = prevComplete;
    const chapters: ChapterNode[] = m.chapters.map((c) => {
      const p = pMap.get(c.id);
      const completed = Boolean(p?.completed);
      const unlocked = prevComplete;
      const watch = p?.watchSeconds ?? 0;
      const read = p?.readSeconds ?? 0;
      const node: ChapterNode = {
        id: c.id,
        number: c.number,
        name: c.name,
        description: c.description,
        moduleId: m.id,
        minWatchSeconds: c.minWatchSeconds,
        minReadSeconds: c.minReadSeconds,
        watchSeconds: watch,
        readSeconds: read,
        requirementsMet: watch >= c.minWatchSeconds && read >= c.minReadSeconds,
        completed,
        completedVia: p?.completedVia ?? null,
        unlocked,
        resourceCount: c._count.resources,
        quiz: c.quiz
          ? buildQuizInfo(
              c.quiz,
              c.quiz._count.questions,
              attempts.filter((a) => a.quizId === c.quiz!.id),
              grants.filter((g) => g.quizId === c.quiz!.id),
            )
          : null,
      };
      total++;
      if (completed) done++;
      prevComplete = completed;
      return node;
    });
    return {
      id: m.id,
      number: m.number,
      name: m.name,
      description: m.description,
      chapters,
      completed: chapters.filter((c) => c.completed).length,
      unlocked: moduleUnlocked,
    };
  });
  return { modules: out, total, completed: done, percent: pct(done, total) };
}

/** Is this chapter unlocked for the student? (previous chapter in domain order complete) */
export async function isChapterUnlocked(studentId: string, domainId: string, chapterId: string): Promise<boolean> {
  const tree = await learningTree(studentId, domainId);
  for (const m of tree.modules) for (const c of m.chapters) if (c.id === chapterId) return c.unlocked;
  return false;
}

export async function markChapterComplete(studentId: string, chapterId: string, via: "MANUAL" | "QUIZ" | "BULK" | "ADMIN") {
  await prisma.chapterProgress.upsert({
    where: { studentId_chapterId: { studentId, chapterId } },
    update: { completed: true, completedAt: new Date(), completedVia: via },
    create: { studentId, chapterId, completed: true, completedAt: new Date(), completedVia: via },
  });
}

/** Course progress % for many students at once (for lists and dashboards). */
export async function learningPercentMany(students: { id: string; domainId: string | null }[]): Promise<Map<string, number>> {
  const domainIds = [...new Set(students.map((s) => s.domainId).filter((d): d is string => Boolean(d)))];
  const counts = await prisma.chapter.groupBy({ by: ["moduleId"], _count: { _all: true }, where: { module: { domainId: { in: domainIds } } } });
  const modules = await prisma.module.findMany({ where: { domainId: { in: domainIds } }, select: { id: true, domainId: true } });
  const perDomain = new Map<string, number>();
  for (const m of modules) {
    const c = counts.find((x) => x.moduleId === m.id)?._count._all ?? 0;
    perDomain.set(m.domainId, (perDomain.get(m.domainId) ?? 0) + c);
  }
  const done = await prisma.chapterProgress.groupBy({
    by: ["studentId"],
    _count: { _all: true },
    where: { studentId: { in: students.map((s) => s.id) }, completed: true },
  });
  const doneMap = new Map(done.map((d) => [d.studentId, d._count._all]));
  const out = new Map<string, number>();
  for (const s of students) {
    const total = s.domainId ? perDomain.get(s.domainId) ?? 0 : 0;
    out.set(s.id, total ? Math.min(100, pct(doneMap.get(s.id) ?? 0, total)) : 0);
  }
  return out;
}

// ───────────── Progress & eligibility ─────────────

export interface EligibilityCheck {
  key: string;
  label: string;
  met: boolean;
  detail: string;
}

export interface StudentProgress {
  accessState: AccessState;
  durationHours: number;
  loggedHours: number;
  hoursRemaining: number;
  learningHours: number;
  learning: { total: number; completed: number; percent: number };
  quizzes: { total: number; passed: number; average: number; exhausted: number };
  logbook: { entries: number; hours: number };
  attendance: AttendanceStats;
  assignments: { total: number; submitted: number; approved: number; pending: number };
  project: { status: string | null; title: string | null };
  report: { status: string | null };
  assessment: { submitted: boolean; score: number; recommend: boolean };
  overallPercent: number;
  eligibility: { eligible: boolean; checks: EligibilityCheck[] };
}

export async function studentProgress(studentId: string): Promise<StudentProgress> {
  const s = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { domain: true, assessment: true } });
  const [tree, logAgg, logCount, att, assignments, subs, rules] = await Promise.all([
    learningTree(studentId, s.domainId),
    prisma.logbookEntry.aggregate({ where: { studentId }, _sum: { hours: true } }),
    prisma.logbookEntry.count({ where: { studentId } }),
    attendanceStats(studentId, s.internshipStart, s.internshipEnd),
    s.domainId ? prisma.assignment.count({ where: { domainId: s.domainId } }) : Promise.resolve(0),
    prisma.submission.findMany({ where: { studentId }, select: { kind: true, status: true, title: true, updatedAt: true } }),
    getEligibilityRules(),
  ]);
  const durationHours = s.domain?.durationHours ?? 120;
  const loggedHours = Math.round((logAgg._sum.hours ?? 0) * 10) / 10;
  const quizzes = tree.modules.flatMap((m) => m.chapters.map((c) => c.quiz).filter((q): q is QuizInfo => Boolean(q)));
  const quizAvg = quizzes.length ? Math.round((quizzes.reduce((a, q) => a + (q.bestPercent ?? 0), 0) / quizzes.length) * 10) / 10 : 0;
  const assignSubs = subs.filter((x) => x.kind === "ASSIGNMENT");
  const project = subs.find((x) => x.kind === "PROJECT") ?? null;
  const report = subs.find((x) => x.kind === "REPORT") ?? null;
  const hoursPct = Math.min(100, pct(loggedHours, durationHours));
  const assessmentScore = s.assessment?.score ?? 0;

  const checks: EligibilityCheck[] = [
    { key: "attendance", label: `Attendance ≥ ${rules.minAttendancePercent}%`, met: att.percent >= rules.minAttendancePercent, detail: `${att.percent}%` },
    { key: "hours", label: `Internship hours ≥ ${Math.round((durationHours * rules.minHoursPercent) / 100)}h`, met: hoursPct >= rules.minHoursPercent, detail: `${loggedHours}h logged` },
    { key: "quiz", label: `Quiz average ≥ ${rules.minQuizAverage}%`, met: quizzes.length === 0 || quizAvg >= rules.minQuizAverage, detail: quizzes.length ? `${quizAvg}%` : "No quizzes" },
  ];
  if (rules.requireAllChapters) checks.push({ key: "chapters", label: "All chapters completed", met: tree.total > 0 && tree.completed === tree.total, detail: `${tree.completed}/${tree.total}` });
  if (rules.requireProjectApproved) checks.push({ key: "project", label: "Live project approved", met: project?.status === "APPROVED", detail: project ? project.status : "Not submitted" });
  if (rules.requireReportApproved) checks.push({ key: "report", label: "Internship report approved", met: report?.status === "APPROVED", detail: report ? report.status : "Not submitted" });
  if (rules.requireMentorRecommendation) checks.push({ key: "assessment", label: "Mentor recommends certificate", met: Boolean(s.assessment?.recommendCertificate), detail: s.assessment ? (s.assessment.recommendCertificate ? "Recommended" : "Not recommended") : "Assessment pending" });

  const subScore = (st: string | undefined | null) => (st === "APPROVED" ? 100 : st ? 50 : 0);
  const overall = Math.round(
    tree.percent * 0.4 + hoursPct * 0.25 + subScore(project?.status) * 0.1 + subScore(report?.status) * 0.1 + (s.assessment ? 100 : 0) * 0.15,
  );

  return {
    accessState: accessState(s),
    durationHours,
    loggedHours,
    hoursRemaining: Math.max(0, Math.round((durationHours - loggedHours) * 10) / 10),
    learningHours: Math.round((s.learningSeconds / 3600) * 10) / 10,
    learning: { total: tree.total, completed: tree.completed, percent: tree.percent },
    quizzes: { total: quizzes.length, passed: quizzes.filter((q) => q.passed).length, average: quizAvg, exhausted: quizzes.filter((q) => !q.passed && q.attemptsRemaining === 0 && !q.openAttemptId && q.attemptsUsed > 0).length },
    logbook: { entries: logCount, hours: loggedHours },
    attendance: att,
    assignments: {
      total: assignments,
      submitted: assignSubs.length,
      approved: assignSubs.filter((x) => x.status === "APPROVED").length,
      pending: assignSubs.filter((x) => x.status === "PENDING").length,
    },
    project: { status: project?.status ?? null, title: project?.title ?? null },
    report: { status: report?.status ?? null },
    assessment: { submitted: Boolean(s.assessment), score: assessmentScore, recommend: Boolean(s.assessment?.recommendCertificate) },
    overallPercent: Math.min(100, overall),
    eligibility: { eligible: checks.every((c) => c.met), checks },
  };
}

// ───────────── Assessment, results, completion ─────────────

export function assessmentScore(ratings: Record<string, string>): number {
  const vals = Object.values(ratings)
    .map((r) => RATINGS.find((x) => x.value === r)?.score)
    .filter((x): x is 40 | 60 | 80 | 100 => typeof x === "number");
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
}

export function gradeFor(score: number): string {
  if (score >= 90) return "O";
  if (score >= 80) return "A+";
  if (score >= 70) return "A";
  if (score >= 60) return "B+";
  if (score >= 50) return "B";
  if (score >= 40) return "C";
  return "F";
}

/** Final score = 40% quiz average + 40% mentor assessment + 20% attendance. */
export async function computeResult(studentId: string) {
  const p = await studentProgress(studentId);
  const score = Math.round((p.quizzes.average * 0.4 + p.assessment.score * 0.4 + p.attendance.percent * 0.2) * 10) / 10;
  const pass = p.eligibility.eligible && score >= 40;
  return { score, grade: pass ? gradeFor(score) : "F", pass, progress: p };
}

export async function publishResult(studentId: string) {
  const r = await computeResult(studentId);
  await prisma.student.update({
    where: { id: studentId },
    data: { resultStatus: r.pass ? "PASS" : "FAIL", grade: r.grade, resultPublishedAt: new Date() },
  });
  return r;
}

/** Issue (or return) the certificate for a passed student. */
export async function issueCertificate(studentId: string) {
  const existing = await prisma.certificate.findUnique({ where: { studentId } });
  if (existing) return existing;
  return prisma.certificate.create({ data: { studentId, certificateNo: await newCertificateNo(), verifyCode: newVerifyCode() } });
}

/** Mark internship complete; attendance is locked from then on (FR-STU-2). */
export async function completeInternship(studentId: string) {
  const s = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  let resultStatus = s.resultStatus;
  if (!s.resultPublishedAt) resultStatus = (await publishResult(studentId)).pass ? "PASS" : "FAIL";
  await prisma.student.update({ where: { id: studentId }, data: { status: "COMPLETED", completedAt: new Date() } });
  if (resultStatus === "PASS") await issueCertificate(studentId);
  return resultStatus;
}

/** Default internship end date for a start date. */
export function defaultEndDate(start: Date, weeks: number): Date {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + weeks * 7 - 1);
  return d;
}

export const parseRatings = (r: string | null | undefined) => parseJson<Record<string, string>>(r, {});

/** Midnight IST for a date string or today. */
export const todayIST = () => istDate(toISTDateString());
