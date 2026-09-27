import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

const schema = z.object({
  action: z.enum(["assign", "remove"]),
  studentIds: z.array(z.string().min(1)).min(1, "Select at least one student").max(500, "Select at most 500 students at a time"),
});

/** Assign or remove same-domain paid students for a mentor (FR-ADM-5). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const mentor = await prisma.mentor.findUnique({ where: { id }, include: { domain: true } });
  if (!mentor) throw notFound("Mentor not found");
  const body = await parseBody(req, schema);
  const ids = [...new Set(body.studentIds)];

  if (body.action === "remove") {
    const res = await prisma.student.updateMany({ where: { id: { in: ids }, mentorId: id }, data: { mentorId: null, mentorAssignedAt: null } });
    if (res.count) await audit(auth.user.id, "MENTOR_ASSIGN", "Mentor", id, { action: "REMOVE", studentIds: ids, count: res.count });
    return { removed: res.count, skipped: ids.length - res.count };
  }

  if (!mentor.active) throw new ApiError(409, "This mentor is inactive. Activate the mentor before assigning students.");
  const students = await prisma.student.findMany({
    where: { id: { in: ids } },
    select: { id: true, userId: true, domainId: true, paymentStatus: true, mentorId: true, name: true },
  });
  const eligible = students.filter((s) => s.paymentStatus === "PAID" && s.domainId === mentor.domainId && s.mentorId !== id);
  const skipped = ids.length - eligible.length;
  if (!eligible.length) {
    throw new ApiError(422, "None of the selected students can be assigned. Only paid students of the mentor's domain who are not already assigned to this mentor qualify.");
  }
  const now = new Date();
  await prisma.student.updateMany({ where: { id: { in: eligible.map((s) => s.id) } }, data: { mentorId: id, mentorAssignedAt: now } });

  await notify(
    eligible.map((s) => s.userId),
    {
      title: "Mentor assigned",
      body: `${mentor.name}${mentor.designation ? ` (${mentor.designation})` : ""} is now your internship mentor for ${mentor.domain.name}.`,
      kind: "INFO",
      link: "/student",
    },
  );
  await notify([mentor.userId], {
    title: "New students assigned",
    body: `${eligible.length} student${eligible.length === 1 ? " has" : "s have"} been assigned to you.`,
    kind: "INFO",
    link: "/mentor/students",
  });
  await audit(auth.user.id, "MENTOR_ASSIGN", "Mentor", id, {
    action: "ASSIGN",
    studentIds: eligible.map((s) => s.id),
    reassignedFrom: eligible.filter((s) => s.mentorId).map((s) => ({ studentId: s.id, previousMentorId: s.mentorId })),
    count: eligible.length,
  });
  return { assigned: eligible.length, skipped };
});
