import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { getInternshipSettings } from "@/lib/settings";
import { toISTDateString } from "@/lib/format";
import { requireActiveStudent } from "@/app/student/_lib/server";

/** FR-STU-3: check-out for today. Requires a check-in; sets PRESENT or HALF_DAY by duration. */
export const POST = route(async () => {
  const { student, t } = await requireActiveStudent();
  const today = toISTDateString();
  const row = await prisma.attendance.findUnique({ where: { studentId_date: { studentId: student.id, date: today } } });
  if (!row?.checkIn) throw new ApiError(409, t("att.err.notIn"));
  if (row.checkOut) throw new ApiError(409, t("att.err.alreadyOut"));

  const settings = await getInternshipSettings();
  const now = new Date();
  const hours = (now.getTime() - row.checkIn.getTime()) / 3_600_000;
  const status = hours < settings.halfDayBelowHours ? "HALF_DAY" : "PRESENT";
  // Guard against a concurrent double check-out.
  const res = await prisma.attendance.updateMany({ where: { id: row.id, checkOut: null }, data: { checkOut: now, status } });
  if (res.count === 0) throw new ApiError(409, t("att.err.alreadyOut"));
  return { date: today, checkIn: row.checkIn, checkOut: now, status, hours: Math.round(hours * 100) / 100 };
});
