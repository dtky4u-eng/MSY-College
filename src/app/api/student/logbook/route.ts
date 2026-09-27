import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { checkDateInWindow, requireActiveStudent } from "@/app/student/_lib/server";
import { logbookSchema } from "@/app/student/_lib/logbook";

/** FR-STU-8: add a daily logbook entry (unique per day, inside the internship window, not in the future). */
export const POST = route(async (req) => {
  const { student, t } = await requireActiveStudent();
  const body = await parseBody(req, logbookSchema(t));
  const dateErr = checkDateInWindow(body.date, student, t);
  if (dateErr) throw new ApiError(422, dateErr, { date: dateErr });
  const exists = await prisma.logbookEntry.findUnique({ where: { studentId_date: { studentId: student.id, date: body.date } }, select: { id: true } });
  if (exists) throw new ApiError(409, t("log.err.duplicate"), { date: t("log.err.duplicate") });
  const entry = await prisma.logbookEntry
    .create({ data: { studentId: student.id, date: body.date, hours: body.hours, activity: body.activity, skills: body.skills } })
    .catch((e: unknown) => {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") throw new ApiError(409, t("log.err.duplicate"), { date: t("log.err.duplicate") });
      throw e;
    });
  return { id: entry.id };
});
