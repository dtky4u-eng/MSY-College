import { prisma } from "@/lib/db";
import { conflict, notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { liveClassSchema, notifyDomainStudents, resolveLiveClass, whenText } from "../_shared";

/** Edit a scheduled live class; students are told when the time or link changes. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, liveClassSchema);
  const existing = await prisma.liveClass.findUnique({ where: { id } });
  if (!existing) throw notFound("Live class not found");
  if (existing.cancelled) throw conflict("A cancelled class cannot be edited.");
  const { domain, data } = await resolveLiveClass(body);
  const updated = await prisma.liveClass.update({ where: { id }, data });

  const rescheduled = existing.startsAt.getTime() !== updated.startsAt.getTime();
  const linkChanged = existing.meetingLink !== updated.meetingLink;
  let notified = 0;
  if ((rescheduled || linkChanged || existing.domainId !== updated.domainId) && updated.startsAt.getTime() > Date.now()) {
    notified = await notifyDomainStudents(
      domain.id,
      rescheduled ? `Live class rescheduled: ${updated.title}` : `Live class updated: ${updated.title}`,
      rescheduled ? `The class now starts on ${whenText(updated.startsAt)} (${updated.durationMinutes} min).` : `The details of the class on ${whenText(updated.startsAt)} have changed. Please use the latest join link on your dashboard.`,
    );
  }
  await audit(auth.user.id, "CONTENT", "LiveClass", id, {
    operation: "UPDATE",
    title: updated.title,
    before: { startsAt: existing.startsAt, meetingLink: existing.meetingLink, domainId: existing.domainId },
    after: { startsAt: updated.startsAt, meetingLink: updated.meetingLink, domainId: updated.domainId },
    notified,
  });
  return { id, notified };
});
