import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { notify } from "@/lib/notify";
import { formatDateTime } from "@/lib/format";
import { fromISTInput } from "@/components/admin/ops/datetime";

const optId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const liveClassSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150, "Title must be 150 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be 2000 characters or fewer")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  domainId: z.string().trim().min(1, "Select a domain"),
  moduleId: optId,
  chapterId: optId,
  meetingLink: z
    .string()
    .trim()
    .min(1, "Enter the meeting link")
    .max(500, "Link is too long")
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    }, "Enter a valid meeting URL starting with https://"),
  startsAt: z.string().refine((v) => fromISTInput(v) !== null, "Select a valid date and time"),
  trainer: z.string().trim().min(2, "Enter the trainer's name").max(100, "Trainer name is too long"),
  durationMinutes: z.coerce.number({ message: "Enter the duration" }).int("Use whole minutes").min(15, "Duration must be at least 15 minutes").max(480, "Duration cannot exceed 8 hours"),
  popupMinutes: z.coerce.number({ message: "Enter the popup lead time" }).int("Use whole minutes").min(0, "Lead time cannot be negative").max(120, "Lead time cannot exceed 120 minutes"),
});

export type LiveClassInput = z.infer<typeof liveClassSchema>;

/** Validate domain → module → chapter consistency and return data for Prisma. */
export async function resolveLiveClass(input: LiveClassInput) {
  const domain = await prisma.domain.findUnique({ where: { id: input.domainId }, select: { id: true, name: true } });
  if (!domain) throw new ApiError(422, "Select a valid domain", { domainId: "Select a valid domain" });
  if (input.chapterId && !input.moduleId) throw new ApiError(422, "Select the module of this chapter", { moduleId: "Select a module first" });
  if (input.moduleId) {
    const m = await prisma.module.findFirst({ where: { id: input.moduleId, domainId: domain.id } });
    if (!m) throw new ApiError(422, "The module does not belong to this domain", { moduleId: "Select a module of this domain" });
  }
  if (input.chapterId) {
    const c = await prisma.chapter.findFirst({ where: { id: input.chapterId, moduleId: input.moduleId! } });
    if (!c) throw new ApiError(422, "The chapter does not belong to this module", { chapterId: "Select a chapter of this module" });
  }
  return {
    domain,
    data: {
      title: input.title,
      description: input.description,
      domainId: domain.id,
      moduleId: input.moduleId,
      chapterId: input.chapterId,
      meetingLink: input.meetingLink,
      startsAt: fromISTInput(input.startsAt)!,
      trainer: input.trainer,
      durationMinutes: input.durationMinutes,
      popupMinutes: input.popupMinutes,
    },
  };
}

/** Notify paid, non-blocked students of a domain. */
export async function notifyDomainStudents(domainId: string, title: string, body: string) {
  const students = await prisma.student.findMany({
    where: { domainId, paymentStatus: "PAID", status: { in: ["ACTIVE", "PENDING"] }, userId: { not: null } },
    select: { userId: true },
  });
  return notify(
    students.map((s) => s.userId),
    { kind: "LIVE_CLASS", title, body, link: "/student" },
  );
}

export const whenText = (d: Date) => `${formatDateTime(d)} IST`;
