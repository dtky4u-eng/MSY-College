import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { getInternshipSettings } from "@/lib/settings";
import { defaultEndDate } from "@/lib/student";
import { formatDate, istDate, toISTDateString } from "@/lib/format";
import { emptyToNull, zRealYmd as realYmd } from "../../students/_helpers";

const schema = z
  .object({
    studentIds: z.array(z.string().min(1).max(64)).min(1, "Select at least one student").max(500, "Select at most 500 students at a time"),
    startDate: realYmd,
    endDate: z.preprocess(emptyToNull, realYmd.nullable().optional()).transform((v) => v ?? null),
    autoAssignMentors: z.boolean().optional().default(false),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "End date must be on or after the start date" })
  .refine((v) => !v.endDate || (istDate(v.endDate).getTime() - istDate(v.startDate).getTime()) / 86400000 <= 366, {
    path: ["endDate"],
    message: "An internship cannot be longer than one year",
  });

interface Skipped {
  id: string;
  name: string | null;
  reason: string;
}

/**
 * Set a common internship start date for one or more paid students (FR-ADM-7).
 * End date defaults to start + configured weeks. Sets status ACTIVE (the student UI shows "Not Started" until the date).
 * Optionally auto-assigns mentors round-robin among active mentors of each student's domain (least-loaded first).
 */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, schema);
  const ids = [...new Set(body.studentIds)];
  const settings = await getInternshipSettings();
  const start = istDate(body.startDate);
  const end = body.endDate ? istDate(body.endDate) : defaultEndDate(start, settings.defaultWeeks);
  const endYmd = toISTDateString(end);

  const students = await prisma.student.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, userId: true, status: true, paymentStatus: true, domainId: true, mentorId: true, internshipStart: true, internshipEnd: true, portalRegNo: true, registrationNumber: true },
  });
  const byId = new Map(students.map((s) => [s.id, s]));
  const skipped: Skipped[] = []; // not updated
  const mentorWarnings: Skipped[] = []; // updated, but no mentor could be auto-assigned
  const eligible: typeof students = [];
  for (const id of ids) {
    const s = byId.get(id);
    if (!s) skipped.push({ id, name: null, reason: "Student not found" });
    else if (s.paymentStatus !== "PAID") skipped.push({ id, name: s.name, reason: "Fee not paid" });
    else if (s.status === "BLOCKED") skipped.push({ id, name: s.name, reason: "Student is blocked" });
    else if (s.status === "COMPLETED") skipped.push({ id, name: s.name, reason: "Internship already completed" });
    else eligible.push(s);
  }

  // Mentor round-robin per domain: mentors ordered by current assigned-student count (ascending).
  const assignments = new Map<string, { id: string; name: string; userId: string }>();
  if (body.autoAssignMentors) {
    const needs = eligible.filter((s) => !s.mentorId);
    const domainIds = [...new Set(needs.map((s) => s.domainId).filter((d): d is string => Boolean(d)))];
    const mentors = domainIds.length
      ? await prisma.mentor.findMany({
          where: { active: true, domainId: { in: domainIds }, user: { active: true } },
          select: { id: true, name: true, userId: true, domainId: true, employeeId: true, _count: { select: { students: true } } },
        })
      : [];
    const pools = new Map<string, typeof mentors>();
    for (const m of mentors) pools.set(m.domainId, [...(pools.get(m.domainId) ?? []), m]);
    for (const pool of pools.values()) pool.sort((a, b) => a._count.students - b._count.students || a.employeeId.localeCompare(b.employeeId));
    const cursor = new Map<string, number>();
    for (const s of needs) {
      if (!s.domainId) {
        mentorWarnings.push({ id: s.id, name: s.name, reason: "No internship domain selected" });
        continue;
      }
      const pool = pools.get(s.domainId);
      if (!pool?.length) {
        mentorWarnings.push({ id: s.id, name: s.name, reason: "No active mentor available in this domain" });
        continue;
      }
      const i = cursor.get(s.domainId) ?? 0;
      const m = pool[i % pool.length]!;
      cursor.set(s.domainId, i + 1);
      assignments.set(s.id, { id: m.id, name: m.name, userId: m.userId });
    }
  }

  const now = new Date();
  await prisma.$transaction(
    eligible.map((s) => {
      const m = assignments.get(s.id);
      return prisma.student.update({
        where: { id: s.id },
        data: { internshipStart: start, internshipEnd: end, status: "ACTIVE", ...(m ? { mentorId: m.id, mentorAssignedAt: now } : {}) },
      });
    }),
  );

  for (const s of eligible) {
    await audit(auth.user.id, "INTERNSHIP_START", "Student", s.id, {
      startDate: body.startDate,
      endDate: endYmd,
      previousStart: s.internshipStart ? toISTDateString(s.internshipStart) : null,
      previousEnd: s.internshipEnd ? toISTDateString(s.internshipEnd) : null,
      statusFrom: s.status,
      bulk: eligible.length > 1,
      batchSize: eligible.length,
    });
    const m = assignments.get(s.id);
    if (m) await audit(auth.user.id, "MENTOR_ASSIGN", "Student", s.id, { from: null, to: m.id, mentorName: m.name, auto: true });
  }

  // Notifications: one per student (mentor name differs per student), plus a summary per mentor.
  const range = `${formatDate(body.startDate)} to ${formatDate(endYmd)}`;
  for (const s of eligible) {
    if (!s.userId) continue;
    const m = assignments.get(s.id);
    const rescheduled = Boolean(s.internshipStart);
    await notify([s.userId], {
      title: rescheduled ? "Your internship dates have changed" : "Your internship start date is set",
      body: `Your internship runs from ${range}.${m ? ` ${m.name} has been assigned as your mentor.` : ""}`,
      kind: "INFO",
      link: "/student",
    });
  }
  const perMentor = new Map<string, { userId: string; count: number }>();
  for (const m of assignments.values()) perMentor.set(m.id, { userId: m.userId, count: (perMentor.get(m.id)?.count ?? 0) + 1 });
  for (const { userId, count } of perMentor.values()) {
    await notify([userId], {
      title: "New students assigned",
      body: `${count} student${count === 1 ? " has" : "s have"} been assigned to you. Internship starts ${formatDate(body.startDate)}.`,
      kind: "INFO",
      link: "/mentor",
    });
  }

  return {
    updated: eligible.length,
    mentorsAssigned: assignments.size,
    skipped,
    mentorWarnings,
    startDate: body.startDate,
    endDate: endYmd,
  };
});
