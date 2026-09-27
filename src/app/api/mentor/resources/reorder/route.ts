import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireMentor } from "@/lib/auth";
import { mentorChapter } from "@/app/mentor/_lib/scope";

const schema = z.object({ chapterId: z.string().min(1), ids: z.array(z.string().min(1)).min(1).max(500) });

/** Reorder a chapter's resources: sortOrder = position (1-based). */
export const POST = route(async (req) => {
  const { mentor } = await requireMentor("api");
  const body = await parseBody(req, schema);
  const chapter = await mentorChapter(mentor, body.chapterId);
  const current = await prisma.resource.findMany({ where: { chapterId: chapter.id }, select: { id: true } });
  const set = new Set(current.map((r) => r.id));
  if (body.ids.length !== set.size || new Set(body.ids).size !== set.size || body.ids.some((id) => !set.has(id))) {
    throw new ApiError(422, "The resource list is out of date. Refresh the page and try again.");
  }
  await prisma.$transaction(body.ids.map((id, i) => prisma.resource.update({ where: { id }, data: { sortOrder: i + 1 } })));
  return { ok: true };
});
