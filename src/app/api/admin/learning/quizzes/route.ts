import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { quizSchema } from "@/components/admin/core/learning/schemas";

const TRACKED = ["title", "description", "passingScore", "attemptsAllowed", "timeLimitMinutes", "randomize", "showResult"] as const;

/** Create or update the quiz of a chapter (one quiz per chapter). */
export const PUT = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, quizSchema);
  const chapter = await prisma.chapter.findUnique({ where: { id: body.chapterId }, include: { quiz: true } });
  if (!chapter) throw new ApiError(422, "Chapter not found", { chapterId: "Chapter not found" });

  const data = {
    title: body.title,
    description: body.description,
    passingScore: body.passingScore,
    attemptsAllowed: body.attemptsAllowed,
    timeLimitMinutes: body.timeLimitMinutes,
    randomize: body.randomize,
    showResult: body.showResult,
  };
  const quiz = await prisma.quiz.upsert({
    where: { chapterId: chapter.id },
    create: { ...data, chapterId: chapter.id, createdById: auth.user.id },
    update: data,
  });
  const before = chapter.quiz;
  if (!before) {
    await audit(auth.user.id, "CONTENT", "Quiz", quiz.id, { action: "CREATE", chapterId: chapter.id, ...data });
  } else {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of TRACKED) if (before[k] !== data[k]) changes[k] = { from: before[k], to: data[k] };
    if (Object.keys(changes).length) await audit(auth.user.id, "CONTENT", "Quiz", quiz.id, { action: "UPDATE", chapterId: chapter.id, changes });
  }
  return { id: quiz.id, created: !before };
});
