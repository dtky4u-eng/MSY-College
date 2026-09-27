import { prisma } from "@/lib/db";
import { ApiError, formFields, formFile, route, validate } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sniffKind } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { quizImportSchema } from "@/components/admin/core/learning/schemas";
import { parseQuizWorkbook, readForm, type ImportIssue } from "@/components/admin/core/learning/server";

const PREVIEW_LIMIT = 100;

/**
 * Import quiz questions for a chapter from Excel (multipart: chapterId, mode = append | replace, dryRun, file).
 * With dryRun=1 the file is only validated and a preview is returned.
 */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const form = await readForm(req);
  const body = validate(quizImportSchema, formFields(form));
  const file = formFile(form, "file");
  if (!file) throw new ApiError(422, "Choose an Excel file to import", { file: "Choose an Excel file to import" });
  if (file.size > LIMITS.excelBytes) throw new ApiError(422, "The Excel file must be 10 MB or smaller", { file: "The Excel file must be 10 MB or smaller" });
  const buf = Buffer.from(await file.arrayBuffer());
  if (sniffKind(buf, file.name) !== "xlsx") {
    throw new ApiError(422, "Upload an .xlsx Excel file (legacy .xls files must be re-saved as .xlsx)", { file: "Upload an .xlsx Excel file" });
  }

  const chapter = await prisma.chapter.findUnique({
    where: { id: body.chapterId },
    include: { quiz: { include: { questions: { select: { text: true } }, _count: { select: { attempts: true } } } } },
  });
  if (!chapter) throw new ApiError(422, "Chapter not found", { chapterId: "Chapter not found" });

  const parsed = await parseQuizWorkbook(buf);
  const errors: ImportIssue[] = [...parsed.errors];
  let valid = parsed.valid;
  if (body.mode === "append" && chapter.quiz) {
    const existing = new Set(chapter.quiz.questions.map((q) => q.text.replace(/\s+/g, " ").trim().toLowerCase()));
    valid = valid.filter((q) => {
      if (!existing.has(q.text.toLowerCase())) return true;
      errors.push({ row: q.row, message: "This question already exists in the quiz" });
      return false;
    });
  }
  errors.sort((a, b) => a.row - b.row);

  const summary = {
    dryRun: body.dryRun,
    mode: body.mode,
    fileName: file.name,
    totalRows: parsed.totalRows,
    validCount: valid.length,
    skipped: errors.length,
    errors,
    existingQuestions: chapter.quiz?.questions.length ?? 0,
    attempts: chapter.quiz?._count.attempts ?? 0,
    preview: valid.slice(0, PREVIEW_LIMIT),
    imported: 0,
    removed: 0,
    quizCreated: false,
    quizId: chapter.quiz?.id ?? null,
  };
  if (body.dryRun) return summary;
  if (!valid.length) throw new ApiError(422, "No valid questions were found in the file. Fix the listed rows and try again.", { file: "No valid questions to import" });

  const result = await prisma.$transaction(async (tx) => {
    let quizId = chapter.quiz?.id;
    let created = false;
    if (!quizId) {
      const quiz = await tx.quiz.create({
        data: { chapterId: chapter.id, title: `${chapter.name} Quiz`.slice(0, 150), passingScore: 60, attemptsAllowed: 3, randomize: false, showResult: true, createdById: auth.user.id },
      });
      quizId = quiz.id;
      created = true;
    }
    let removed = 0;
    let start = 0;
    if (body.mode === "replace") {
      removed = (await tx.question.deleteMany({ where: { quizId } })).count;
    } else {
      start = (await tx.question.aggregate({ where: { quizId }, _max: { sort: true } }))._max.sort ?? 0;
    }
    await tx.question.createMany({
      data: valid.map((q, i) => ({
        quizId: quizId!,
        text: q.text,
        options: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        marks: q.marks,
        explanation: q.explanation,
        sort: start + i + 1,
      })),
    });
    return { quizId, created, removed };
  });

  await audit(auth.user.id, "CONTENT", "Quiz", result.quizId, {
    action: "IMPORT_QUESTIONS",
    chapterId: chapter.id,
    fileName: file.name,
    mode: body.mode,
    imported: valid.length,
    removed: result.removed,
    skipped: errors.length,
    quizCreated: result.created,
  });
  return { ...summary, imported: valid.length, removed: result.removed, quizCreated: result.created, quizId: result.quizId };
});
