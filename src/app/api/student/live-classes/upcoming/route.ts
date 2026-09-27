import { route } from "@/lib/http";
import { requireAnyStudent } from "@/app/student/_lib/server";
import { upcomingClasses } from "@/app/student/_lib/live";

/** FR-STU-13: upcoming (not cancelled, not ended) live classes of the student's domain. Active interns only. */
export const GET = route(async () => {
  const { student, state } = await requireAnyStudent();
  if (state !== "ACTIVE") return { items: [], serverNow: new Date().toISOString() };
  return { items: await upcomingClasses(student), serverNow: new Date().toISOString() };
});
