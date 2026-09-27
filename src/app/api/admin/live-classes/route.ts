import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { liveClassSchema, notifyDomainStudents, resolveLiveClass, whenText } from "./_shared";

/** Schedule a live class (FR-ADM-11) and notify paid students of the domain. */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, liveClassSchema);
  const { domain, data } = await resolveLiveClass(body);
  if (data.startsAt.getTime() < Date.now() - 60_000) throw new ApiError(422, "The class must be scheduled in the future", { startsAt: "Choose a future date and time" });
  const lc = await prisma.liveClass.create({ data });
  const notified = await notifyDomainStudents(domain.id, `Live class scheduled: ${lc.title}`, `${lc.trainer} will take a live class on ${whenText(lc.startsAt)} (${lc.durationMinutes} min). The join link will appear on your dashboard.`);
  await audit(auth.user.id, "CONTENT", "LiveClass", lc.id, { operation: "CREATE", title: lc.title, domain: domain.name, startsAt: lc.startsAt, notified });
  return { id: lc.id, notified };
});
