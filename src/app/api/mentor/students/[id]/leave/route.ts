import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route, zYmd } from "@/lib/http";
import { requireMentor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { formatDate, istWeekday, toISTDateString } from "@/lib/format";
import { assignedStudent } from "@/app/mentor/_lib/scope";

const schema = z.object({ date: zYmd, remarks: z.string().trim().min(3, "Enter the reason for leave").max(300) });

function window(s: { internshipStart: Date | null; internshipEnd: Date | null; status: string }) {
  if (!s.internshipStart) throw new ApiError(409, "The internship has not been scheduled yet");
  if (s.status === "COMPLETED" || s.status === "BLOCKED") throw new ApiError(409, "Attendance is locked for this student");
  return { start: toISTDateString(s.internshipStart), end: s.internshipEnd ? toISTDateString(s.internshipEnd) : null };
}

/** Approve leave for an assigned student on a date within the internship window. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { mentor, auth } = await requireMentor("api");
  const body = await parseBody(req, schema);
  const s = await assignedStudent(mentor, id);
  const { start, end } = window(s);
  if (body.date < start || (end && body.date > end)) throw new ApiError(422, "Date must be within the internship window", { date: "Date must be within the internship window" });
  if (istWeekday(body.date) === 0) throw new ApiError(422, "Sundays are not working days", { date: "Sundays are not working days" });
  const existing = await prisma.attendance.findUnique({ where: { studentId_date: { studentId: s.id, date: body.date } } });
  if (existing && (existing.status === "PRESENT" || existing.status === "HALF_DAY")) {
    throw new ApiError(409, "The student is already marked present on this date", { date: "Already marked present on this date" });
  }
  const row = await prisma.attendance.upsert({
    where: { studentId_date: { studentId: s.id, date: body.date } },
    update: { status: "LEAVE", remarks: body.remarks, markedById: auth.user.id, generated: false },
    create: { studentId: s.id, date: body.date, status: "LEAVE", remarks: body.remarks, markedById: auth.user.id },
  });
  await audit(auth.user.id, "ATTENDANCE_MARK", "Attendance", row.id, { studentId: s.id, date: body.date, status: "LEAVE", previous: existing?.status ?? null, by: "MENTOR" });
  await notify([s.userId], { title: "Leave approved", body: `Your mentor approved leave for ${formatDate(body.date)}.`, kind: "INFO", link: "/student/attendance" });
  return { date: row.date, status: row.status };
});

/** Revoke a leave approved by a mentor or admin (?date=YYYY-MM-DD). */
export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { mentor, auth } = await requireMentor("api");
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(422, "Use a valid date");
  const s = await assignedStudent(mentor, id);
  window(s);
  const row = await prisma.attendance.findUnique({ where: { studentId_date: { studentId: s.id, date } } });
  if (!row || row.status !== "LEAVE") throw new ApiError(404, "No approved leave on this date");
  if (!row.markedById || row.checkIn) throw new ApiError(409, "This leave record cannot be revoked");
  await prisma.attendance.delete({ where: { id: row.id } });
  await audit(auth.user.id, "ATTENDANCE_MARK", "Attendance", row.id, { studentId: s.id, date, status: null, previous: "LEAVE", by: "MENTOR", revoked: true });
  return { revoked: true };
});
