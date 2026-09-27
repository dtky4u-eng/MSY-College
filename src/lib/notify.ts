import "server-only";
import { prisma } from "./db";

export interface NotifyInput {
  title: string;
  body: string;
  kind?: "INFO" | "MESSAGE" | "PAYMENT" | "REVIEW" | "LIVE_CLASS" | "SYSTEM";
  link?: string | null;
}

/** Create in-app notifications for one or more users. */
export async function notify(userIds: (string | null | undefined)[], input: NotifyInput) {
  const ids = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
  if (!ids.length) return 0;
  const res = await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, title: input.title, body: input.body, kind: input.kind ?? "INFO", link: input.link ?? null })),
  });
  return res.count;
}
