import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { chapterCreateSchema } from "@/components/admin/core/learning/schemas";
import { rethrowUnique } from "@/components/admin/core/learning/server";

/** Add a chapter to a module. Watch/reading times are entered in minutes and stored in seconds. */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, chapterCreateSchema);
  const mod = await prisma.module.findUnique({ where: { id: body.moduleId }, select: { id: true, domainId: true, number: true } });
  if (!mod) throw new ApiError(422, "Module not found", { moduleId: "Module not found" });
  const taken = `Chapter ${body.number} already exists in this module`;
  if (await prisma.chapter.findUnique({ where: { moduleId_number: { moduleId: mod.id, number: body.number } } })) throw new ApiError(409, taken, { number: taken });

  const chapter = await prisma.chapter
    .create({
      data: {
        moduleId: mod.id,
        number: body.number,
        name: body.name,
        description: body.description,
        minWatchSeconds: Math.round(body.minWatchMinutes * 60),
        minReadSeconds: Math.round(body.minReadMinutes * 60),
      },
    })
    .catch((e) => rethrowUnique(e, { number: { field: "number", message: taken } }));
  await audit(auth.user.id, "CONTENT", "Chapter", chapter.id, { action: "CREATE", moduleId: mod.id, number: chapter.number, name: chapter.name });
  return { id: chapter.id, moduleId: mod.id, domainId: mod.domainId };
});
