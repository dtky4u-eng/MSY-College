import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { requireActiveStudent } from "@/app/student/_lib/server";

/** FR-STU-13: record joining a live class (opens from popupMinutes before start until the class ends). */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const { student, t } = await requireActiveStudent();
  const c = await prisma.liveClass.findFirst({ where: { id, domainId: student.domainId ?? "__none__" } });
  if (!c) throw new ApiError(404, t("live.err.notFound"));
  if (c.cancelled) throw new ApiError(409, t("live.err.cancelled"));
  const now = Date.now();
  const start = c.startsAt.getTime();
  const end = start + c.durationMinutes * 60_000;
  const opensAt = start - Math.max(c.popupMinutes, 15) * 60_000;
  if (now >= end) throw new ApiError(409, t("live.err.ended"));
  if (now < opensAt) throw new ApiError(409, t("live.err.notOpen"));
  const row = await prisma.liveClassAttendance.upsert({
    where: { liveClassId_studentId: { liveClassId: c.id, studentId: student.id } },
    update: { leftAt: null }, // re-joining keeps the first join time
    create: { liveClassId: c.id, studentId: student.id },
  });
  return { joinedAt: row.joinedAt, meetingLink: c.meetingLink };
});
