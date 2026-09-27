import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireMentor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { mentorChapter } from "@/app/mentor/_lib/scope";

const question = z
  .object({
    id: z.string().optional().nullable(),
    text: z.string().trim().min(3, "Question text must be at least 3 characters").max(2000),
    options: z.array(z.string().trim().min(1, "Options cannot be empty").max(500)).min(2, "Add at least 2 options").max(6, "Use at most 6 options"),
    correctIndex: z.number().int().min(0, "Choose the correct answer"),
    marks: z.number().int("Marks must be a whole number").min(1, "Marks must be at least 1").max(100),
    explanation: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
  })
  .refine((q) => q.correctIndex < q.options.length, { path: ["correctIndex"], message: "Choose the correct answer" })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, { path: ["options"], message: "Options must be different from each other" });

const schema = z.object({
  chapterId: z.string().min(1, "Choose a chapter"),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  passingScore: z.number().int("Passing score must be a whole number").min(0, "Passing score must be between 0 and 100").max(100, "Passing score must be between 0 and 100"),
  attemptsAllowed: z.number().int("Attempts must be a whole number").min(1, "Allow at least 1 attempt").max(20),
  timeLimitMinutes: z.number().int("Time limit must be whole minutes").min(1, "Time limit must be at least 1 minute").max(300).nullable().optional(),
  randomize: z.boolean(),
  showResult: z.boolean(),
  questions: z.array(question).min(1, "Add at least one question").max(200),
});

/** Create or update the quiz of a chapter in the mentor's domain (max one per chapter, FR-MEN-3). */
export const POST = route(async (req) => {
  const { mentor, auth } = await requireMentor("api");
  const body = await parseBody(req, schema);
  const chapter = await mentorChapter(mentor, body.chapterId);
  const existing = await prisma.quiz.findUnique({ where: { chapterId: chapter.id }, include: { questions: { select: { id: true } } } });
  const keepIds = new Set(existing?.questions.map((q) => q.id) ?? []);
  for (const q of body.questions) if (q.id && !keepIds.has(q.id)) throw new ApiError(422, "The quiz changed since you opened it. Refresh and try again.");

  const settings = {
    title: body.title,
    description: body.description,
    passingScore: body.passingScore,
    attemptsAllowed: body.attemptsAllowed,
    timeLimitMinutes: body.timeLimitMinutes ?? null,
    randomize: body.randomize,
    showResult: body.showResult,
  };
  const quiz = await prisma.$transaction(async (tx) => {
    const qz = existing
      ? await tx.quiz.update({ where: { id: existing.id }, data: settings })
      : await tx.quiz.create({ data: { ...settings, chapterId: chapter.id, createdById: auth.user.id } });
    const incoming = new Set(body.questions.map((q) => q.id).filter((x): x is string => Boolean(x)));
    const removed = [...keepIds].filter((id) => !incoming.has(id));
    if (removed.length) await tx.question.deleteMany({ where: { quizId: qz.id, id: { in: removed } } });
    for (const [i, q] of body.questions.entries()) {
      const data = { text: q.text, options: JSON.stringify(q.options), correctIndex: q.correctIndex, marks: q.marks, explanation: q.explanation, sort: i + 1 };
      if (q.id) await tx.question.update({ where: { id: q.id }, data });
      else await tx.question.create({ data: { ...data, quizId: qz.id } });
    }
    return qz;
  });
  await audit(auth.user.id, "CONTENT", "Quiz", quiz.id, { action: existing ? "update" : "create", chapterId: chapter.id, questions: body.questions.length });
  return { id: quiz.id, created: !existing };
});
