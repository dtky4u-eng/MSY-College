import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { questionCreateSchema } from "@/components/admin/core/learning/schemas";

/** Add a multiple-choice question to a quiz (appended at the end). */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, questionCreateSchema);
  const quiz = await prisma.quiz.findUnique({ where: { id: body.quizId }, select: { id: true, chapterId: true } });
  if (!quiz) throw new ApiError(422, "Quiz not found", { quizId: "Quiz not found" });
  const last = await prisma.question.aggregate({ where: { quizId: quiz.id }, _max: { sort: true } });
  const q = await prisma.question.create({
    data: {
      quizId: quiz.id,
      text: body.text,
      options: JSON.stringify(body.options),
      correctIndex: body.correctIndex,
      marks: body.marks,
      explanation: body.explanation,
      sort: (last._max.sort ?? 0) + 1,
    },
  });
  await audit(auth.user.id, "CONTENT", "Question", q.id, { action: "CREATE", quizId: quiz.id, chapterId: quiz.chapterId, text: body.text.slice(0, 120) });
  return { id: q.id };
});
