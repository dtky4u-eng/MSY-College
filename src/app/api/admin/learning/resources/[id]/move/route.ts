import { prisma } from "@/lib/db";
import { badRequest, notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { moveSchema } from "@/components/admin/core/learning/schemas";
import { neighbourPosition, resequenceResources } from "@/components/admin/core/learning/server";

/** Move a resource one place up or down within its chapter. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const { direction } = await parseBody(req, moveSchema);
  const resource = await prisma.resource.findUnique({ where: { id }, select: { chapterId: true, title: true } });
  if (!resource) throw notFound("Resource not found");
  const rows = await prisma.resource.findMany({ where: { chapterId: resource.chapterId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const position = neighbourPosition(rows, id, direction);
  if (position === null) throw badRequest(direction === "up" ? "This resource is already first" : "This resource is already last");
  await resequenceResources(resource.chapterId, id, position);
  await audit(auth.user.id, "CONTENT", "Resource", id, { action: "REORDER", chapterId: resource.chapterId, title: resource.title, position });
  return { position };
});
