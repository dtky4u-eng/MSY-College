import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";

const schema = z.object({ ids: z.array(z.string()).max(200).optional(), all: z.boolean().optional() });

export const POST = route(async (req) => {
  const auth = await requireApiRole();
  const { ids, all } = await parseBody(req, schema);
  const res = await prisma.notification.updateMany({
    where: { userId: auth.user.id, read: false, ...(all ? {} : { id: { in: ids ?? [] } }) },
    data: { read: true },
  });
  return { updated: res.count };
});
