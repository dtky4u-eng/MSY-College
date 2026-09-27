// Server-side data helpers shared by the admin core pages and API routes.
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";

/** Successful-payment revenue (paise) per college. */
export async function revenueByCollege(collegeIds?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.payment.findMany({
    where: { status: "SUCCESS", ...(collegeIds ? { student: { collegeId: { in: collegeIds } } } : {}) },
    select: { amount: true, student: { select: { collegeId: true } } },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.student.collegeId, (map.get(r.student.collegeId) ?? 0) + r.amount);
  return map;
}

/** Paid-student count per college. */
export async function paidByCollege(collegeIds?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.student.groupBy({
    by: ["collegeId"],
    _count: { _all: true },
    where: { paymentStatus: "PAID", ...(collegeIds ? { collegeId: { in: collegeIds } } : {}) },
  });
  return new Map(rows.map((r) => [r.collegeId, r._count._all]));
}

/** Throw a friendly 409/422 for unique-constraint violations on the given field map (target column → form field). */
export function rethrowUnique(err: unknown, fields: Record<string, { field: string; message: string }>): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = ([] as string[]).concat((err.meta?.target as string[] | string | undefined) ?? []).join(",");
    for (const [col, f] of Object.entries(fields)) {
      if (target.includes(col)) throw new ApiError(409, f.message, { [f.field]: f.message });
    }
    throw new ApiError(409, "A record with these details already exists.");
  }
  throw err;
}

/** Ensure a username / email is not taken by another user. Throws 409 with a field message. */
export async function assertUserUnique(opts: { username?: string | null; email?: string | null; exceptUserId?: string | null; usernameField?: string; emailField?: string }) {
  const { username, email, exceptUserId } = opts;
  if (username) {
    const u = await prisma.user.findUnique({ where: { username } });
    if (u && u.id !== exceptUserId) {
      const f = opts.usernameField ?? "username";
      throw new ApiError(409, "This username is already in use", { [f]: "This username is already in use" });
    }
  }
  if (email) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u && u.id !== exceptUserId) {
      const f = opts.emailField ?? "loginEmail";
      throw new ApiError(409, "This email is already linked to another login", { [f]: "This email is already linked to another login" });
    }
  }
}
