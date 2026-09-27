import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, badRequest } from "@/lib/http";
import { fromISTInput } from "@/components/admin/ops/datetime";

export const routineSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150, "Title must be 150 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1000 characters or fewer")
    .optional()
    .transform((v) => (v ? v : null)),
  domainId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  publishAt: z.string().refine((v) => fromISTInput(v) !== null, "Select a valid publish date and time"),
  active: z
    .enum(["true", "false"], { message: "Choose active or hidden" })
    .optional()
    .default("true")
    .transform((v) => v === "true"),
});

export async function readForm(req: Request) {
  try {
    return await req.formData();
  } catch {
    throw badRequest("Send the routine as multipart form data");
  }
}

export async function checkDomain(domainId: string | null) {
  if (!domainId) return;
  const d = await prisma.domain.findUnique({ where: { id: domainId }, select: { id: true } });
  if (!d) throw new ApiError(422, "Select a valid domain", { domainId: "Select a valid domain" });
}
