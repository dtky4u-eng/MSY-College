import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { requireActiveStudent } from "@/app/student/_lib/server";

/** FR-STU-13: record leaving a live class ("I've left the class"). */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const { student, t } = await requireActiveStudent();
  const row = await prisma.liveClassAttendance.findUnique({ where: { liveClassId_studentId: { liveClassId: id, studentId: student.id } } });
  if (!row) throw new ApiError(409, t("live.err.notJoined"));
  if (row.leftAt) return { leftAt: row.leftAt };
  const c = await prisma.liveClass.findUnique({ where: { id }, select: { startsAt: true, durationMinutes: true } });
  const end = c ? new Date(c.startsAt.getTime() + c.durationMinutes * 60_000) : new Date();
  const leftAt = new Date(Math.min(Date.now(), end.getTime()));
  await prisma.liveClassAttendance.update({ where: { id: row.id }, data: { leftAt } });
  return { leftAt };
});
