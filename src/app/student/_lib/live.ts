import "server-only";
import { prisma } from "@/lib/db";

export interface UpcomingClass {
  id: string;
  title: string;
  description: string | null;
  trainer: string;
  meetingLink: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  popupMinutes: number;
  moduleName: string | null;
  chapterName: string | null;
  live: boolean;
  joinedAt: string | null;
  leftAt: string | null;
}

/** FR-STU-13: the student's domain classes that are not cancelled and have not ended, soonest first. */
export async function upcomingClasses(student: { id: string; domainId: string | null }, limit = 20): Promise<UpcomingClass[]> {
  if (!student.domainId) return [];
  const now = Date.now();
  const rows = await prisma.liveClass.findMany({
    where: { domainId: student.domainId, cancelled: false, startsAt: { gte: new Date(now - 24 * 3600_000) } },
    orderBy: { startsAt: "asc" },
    include: {
      module: { select: { number: true, name: true } },
      chapter: { select: { number: true, name: true } },
      attendance: { where: { studentId: student.id }, select: { joinedAt: true, leftAt: true } },
    },
    take: 100,
  });
  return rows
    .map((c) => {
      const start = c.startsAt.getTime();
      const end = start + c.durationMinutes * 60_000;
      const a = c.attendance[0];
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        trainer: c.trainer,
        meetingLink: c.meetingLink,
        startsAt: c.startsAt.toISOString(),
        endsAt: new Date(end).toISOString(),
        durationMinutes: c.durationMinutes,
        popupMinutes: c.popupMinutes,
        moduleName: c.module ? `${c.module.number}. ${c.module.name}` : null,
        chapterName: c.chapter ? `${c.chapter.number}. ${c.chapter.name}` : null,
        live: start <= now && now < end,
        joinedAt: a?.joinedAt.toISOString() ?? null,
        leftAt: a?.leftAt?.toISOString() ?? null,
        _end: end,
      };
    })
    .filter((c) => c._end > now)
    .slice(0, limit)
    .map(({ _end, ...c }) => c);
}
