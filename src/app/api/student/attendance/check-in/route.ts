import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { getInternshipSettings } from "@/lib/settings";
import { toISTDateString } from "@/lib/format";
import { checkDateInWindow, requireActiveStudent } from "@/app/student/_lib/server";

/** Current IST wall-clock time as "HH:MM". */
function istHHMM(d = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/**
 * FR-STU-3: daily check-in (IST). One row per student per day. Until check-out the day is provisionally a
 * Half Day; check-out upgrades it to Present when the duration reaches the configured threshold.
 */
export const POST = route(async () => {
  const { student, t } = await requireActiveStudent();
  const today = toISTDateString();
  const windowErr = checkDateInWindow(today, student, t);
  if (windowErr) throw new ApiError(403, windowErr);
  const settings = await getInternshipSettings();
  if (settings.checkInFrom && istHHMM() < settings.checkInFrom) throw new ApiError(409, t("att.err.tooEarly", { time: settings.checkInFrom }));

  const existing = await prisma.attendance.findUnique({ where: { studentId_date: { studentId: student.id, date: today } } });
  if (existing?.checkIn) throw new ApiError(409, t("att.err.alreadyIn"));
  if (existing) throw new ApiError(409, t("att.err.alreadyRecorded", { status: t(`att.${existing.status}`) }));

  const row = await prisma.attendance
    .create({ data: { studentId: student.id, date: today, checkIn: new Date(), status: "HALF_DAY" } })
    .catch((e: unknown) => {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") throw new ApiError(409, t("att.err.alreadyIn"));
      throw e;
    });
  return { id: row.id, date: row.date, checkIn: row.checkIn, status: row.status };
});
