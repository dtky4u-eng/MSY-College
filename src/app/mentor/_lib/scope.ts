// Mentor data-scope helpers (AR-6): only students with mentorId = mentor.id, only chapters in mentor.domainId.
import "server-only";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { quizAttemptInfo, type QuizInfo } from "@/lib/student";

export interface ExhaustedItem {
  student: { id: string; name: string; registrationNumber: string; userId: string | null };
  quiz: { id: string; title: string };
  chapter: { id: string; number: number; name: string; moduleNumber: number; moduleName: string };
  info: QuizInfo;
  lastAttemptAt: Date | null;
}

/** Assigned students whose quiz attempts are exhausted and who have not passed (FR-MEN-1, FR-MEN-4). */
export async function exhaustedQuizzes(mentor: { id: string; domainId: string }, opts: { studentId?: string } = {}): Promise<ExhaustedItem[]> {
  const students = await prisma.student.findMany({
    where: { mentorId: mentor.id, domainId: mentor.domainId, status: { not: "BLOCKED" }, ...(opts.studentId ? { id: opts.studentId } : {}) },
    select: { id: true, name: true, registrationNumber: true, userId: true },
  });
  if (!students.length) return [];
  const quizzes = await prisma.quiz.findMany({
    where: { chapter: { module: { domainId: mentor.domainId } } },
    select: { id: true, title: true, chapter: { select: { id: true, number: true, name: true, module: { select: { number: true, name: true } } } } },
  });
  if (!quizzes.length) return [];
  const attempts = await prisma.quizAttempt.findMany({
    where: { studentId: { in: students.map((s) => s.id) }, quizId: { in: quizzes.map((q) => q.id) } },
    select: { studentId: true, quizId: true, passed: true, submittedAt: true, startedAt: true },
  });
  const pairs = new Map<string, { studentId: string; quizId: string; passed: boolean; last: Date | null }>();
  for (const a of attempts) {
    const k = `${a.studentId}|${a.quizId}`;
    const p = pairs.get(k) ?? { studentId: a.studentId, quizId: a.quizId, passed: false, last: null };
    p.passed ||= a.passed;
    const t = a.submittedAt ?? a.startedAt;
    if (!p.last || t > p.last) p.last = t;
    pairs.set(k, p);
  }
  const sMap = new Map(students.map((s) => [s.id, s]));
  const qMap = new Map(quizzes.map((q) => [q.id, q]));
  const out: ExhaustedItem[] = [];
  for (const p of pairs.values()) {
    if (p.passed) continue;
    const info = await quizAttemptInfo(p.quizId, p.studentId);
    if (!info || info.passed || info.attemptsRemaining > 0 || info.openAttemptId || info.attemptsUsed === 0) continue;
    const q = qMap.get(p.quizId)!;
    out.push({
      student: sMap.get(p.studentId)!,
      quiz: { id: q.id, title: q.title },
      chapter: { id: q.chapter.id, number: q.chapter.number, name: q.chapter.name, moduleNumber: q.chapter.module.number, moduleName: q.chapter.module.name },
      info,
      lastAttemptAt: p.last,
    });
  }
  return out.sort((a, b) => (b.lastAttemptAt?.getTime() ?? 0) - (a.lastAttemptAt?.getTime() ?? 0));
}

/** Look up a chapter only if it belongs to the mentor's domain; throws 404 otherwise. */
export async function mentorChapter(mentor: { domainId: string }, chapterId: string) {
  const ch = await prisma.chapter.findFirst({ where: { id: chapterId, module: { domainId: mentor.domainId } }, include: { module: true } });
  if (!ch) throw new ApiError(404, "Chapter not found in your domain");
  return ch;
}

/** Look up an assigned student; throws 404 otherwise. */
export async function assignedStudent(mentor: { id: string }, studentId: string) {
  const s = await prisma.student.findFirst({ where: { id: studentId, mentorId: mentor.id } });
  if (!s) throw new ApiError(404, "Student not found among your assigned students");
  return s;
}
