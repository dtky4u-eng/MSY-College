import { prisma } from "@/lib/db";
import { notFound, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";

/** Attendee list with join/leave times (FR-ADM-11). */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  await requireApiRole("ADMIN");
  const lc = await prisma.liveClass.findUnique({ where: { id }, select: { id: true, title: true, startsAt: true, durationMinutes: true, domainId: true } });
  if (!lc) throw notFound("Live class not found");
  const [rows, eligible] = await Promise.all([
    prisma.liveClassAttendance.findMany({
      where: { liveClassId: id },
      orderBy: { joinedAt: "asc" },
      include: { student: { select: { id: true, name: true, registrationNumber: true, portalRegNo: true, college: { select: { name: true } } } } },
    }),
    prisma.student.count({ where: { domainId: lc.domainId, paymentStatus: "PAID", status: { in: ["ACTIVE", "PENDING", "COMPLETED"] } } }),
  ]);
  return {
    eligible,
    attendees: rows.map((r) => ({
      id: r.id,
      studentId: r.student.id,
      name: r.student.name,
      regNo: r.student.portalRegNo ?? r.student.registrationNumber,
      college: r.student.college.name,
      joinedAt: r.joinedAt.toISOString(),
      leftAt: r.leftAt?.toISOString() ?? null,
      minutes: r.leftAt ? Math.max(0, Math.round((r.leftAt.getTime() - r.joinedAt.getTime()) / 60000)) : null,
    })),
  };
});
