import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { checkDateInWindow, requireActiveStudent } from "@/app/student/_lib/server";
import { logbookSchema } from "@/app/student/_lib/logbook";

/** FR-STU-8: edit one of your own entries (not after completion — enforced by requireActiveStudent). */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { student, t } = await requireActiveStudent();
  const entry = await prisma.logbookEntry.findFirst({ where: { id, studentId: student.id } });
  if (!entry) throw new ApiError(404, t("log.err.notFound"));
  const body = await parseBody(req, logbookSchema(t));
  const dateErr = checkDateInWindow(body.date, student, t);
  if (dateErr) throw new ApiError(422, dateErr, { date: dateErr });
  if (body.date !== entry.date) {
    const clash = await prisma.logbookEntry.findUnique({ where: { studentId_date: { studentId: student.id, date: body.date } }, select: { id: true } });
    if (clash) throw new ApiError(409, t("log.err.duplicate"), { date: t("log.err.duplicate") });
  }
  await prisma.logbookEntry.update({ where: { id: entry.id }, data: { date: body.date, hours: body.hours, activity: body.activity, skills: body.skills } });
  return { id: entry.id };
});
