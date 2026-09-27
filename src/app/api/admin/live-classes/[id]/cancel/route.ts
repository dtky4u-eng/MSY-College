import { prisma } from "@/lib/db";
import { conflict, notFound, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notifyDomainStudents, whenText } from "../../_shared";

/** Cancel a live class and inform the students of the domain. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const lc = await prisma.liveClass.findUnique({ where: { id } });
  if (!lc) throw notFound("Live class not found");
  if (lc.cancelled) throw conflict("This class is already cancelled.");
  if (lc.startsAt.getTime() + lc.durationMinutes * 60_000 < Date.now()) throw conflict("This class has already taken place and cannot be cancelled.");
  await prisma.liveClass.update({ where: { id }, data: { cancelled: true } });
  const notified = await notifyDomainStudents(lc.domainId, `Live class cancelled: ${lc.title}`, `The live class scheduled for ${whenText(lc.startsAt)} has been cancelled.`);
  await audit(auth.user.id, "CONTENT", "LiveClass", id, { operation: "CANCEL", title: lc.title, startsAt: lc.startsAt, notified });
  return { id, notified };
});
