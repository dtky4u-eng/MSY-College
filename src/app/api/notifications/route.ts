import { prisma } from "@/lib/db";
import { route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";

export const GET = route(async () => {
  const auth = await requireApiRole();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: auth.user.id, read: false } }),
  ]);
  return { items, unread };
});
