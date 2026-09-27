import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { isChapterUnlocked } from "@/lib/student";
import { toISTDateString } from "@/lib/format";
import { requireActiveStudent } from "@/app/student/_lib/server";

const schema = z.object({
  chapterId: z.string().min(1).max(64),
  kind: z.enum(["watch", "read"]),
  seconds: z.number().int().min(1).max(120),
});

const MAX_PER_BEAT = 30;
const TOLERANCE = 5;

/**
 * FR-STU-6 engagement heartbeat. The client sends one every ~15 s while the chapter page is visible.
 * The server credits at most 30 s per beat and never more than the wall-clock time elapsed since the
 * previous beat for this chapter (+5 s tolerance), so parallel tabs or replayed requests cannot inflate time.
 */
export const POST = route(async (req) => {
  const { student, t } = await requireActiveStudent();
  const body = await parseBody(req, schema);
  if (!student.domainId) throw new ApiError(409, t("learn.err.noDomain"));

  const chapter = await prisma.chapter.findFirst({ where: { id: body.chapterId, module: { domainId: student.domainId } }, select: { id: true } });
  if (!chapter) throw new ApiError(404, t("learn.err.chapterNotFound"));
  if (!(await isChapterUnlocked(student.id, student.domainId, chapter.id))) throw new ApiError(403, t("learn.err.locked"));

  const where = { studentId_chapterId: { studentId: student.id, chapterId: chapter.id } };
  const progress = await prisma.chapterProgress.findUnique({ where });
  const now = Date.now();
  let credit: number;
  if (!progress) {
    // First beat for this chapter: open the tracking window, no credit yet.
    await prisma.chapterProgress.create({ data: { studentId: student.id, chapterId: chapter.id } }).catch(() => undefined);
    credit = 0;
  } else {
    const elapsed = Math.floor((now - progress.updatedAt.getTime()) / 1000) + TOLERANCE;
    credit = Math.max(0, Math.min(body.seconds, MAX_PER_BEAT, elapsed));
  }

  const field = body.kind === "watch" ? "watchSeconds" : "readSeconds";
  const today = toISTDateString();
  // Always touch the progress row so updatedAt marks this beat (closes the window for replays).
  const updated = await prisma.chapterProgress.update({
    where,
    data: { [field]: { increment: credit } },
    select: { watchSeconds: true, readSeconds: true },
  });
  if (credit > 0) {
    await Promise.all([
      prisma.student.update({ where: { id: student.id }, data: { learningSeconds: { increment: credit } } }),
      prisma.attendance.updateMany({ where: { studentId: student.id, date: today }, data: { learningSeconds: { increment: credit } } }),
    ]);
  }
  return { credited: credit, watchSeconds: updated.watchSeconds, readSeconds: updated.readSeconds };
});
