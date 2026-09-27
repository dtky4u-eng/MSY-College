// Audit trail for admin/college actions on payments, student status, passwords, bulk jobs and settlements (NFR-5).
import "server-only";
import { headers } from "next/headers";
import { prisma } from "./db";

export type AuditAction =
  | "LOGIN"
  | "PASSWORD_CHANGE"
  | "PASSWORD_RESET"
  | "PAYMENT_MARK_PAID"
  | "PAYMENT_EDIT"
  | "PAYMENT_RECEIPT"
  | "PAYMENT_REFUND"
  | "STUDENT_CREATE"
  | "STUDENT_UPDATE"
  | "STUDENT_STATUS"
  | "STUDENT_IMPORT"
  | "INTERNSHIP_START"
  | "MENTOR_ASSIGN"
  | "COLLEGE_CREATE"
  | "COLLEGE_UPDATE"
  | "DOMAIN_FEE"
  | "MENTOR_CREATE"
  | "MENTOR_UPDATE"
  | "SETTLEMENT"
  | "BULK_JOB"
  | "QUIZ_REATTEMPT"
  | "RESULT_PUBLISH"
  | "ATTENDANCE_MARK"
  | "SETTINGS"
  | "MESSAGE"
  | "CONTENT";

export async function audit(
  actorId: string | null | undefined,
  action: AuditAction,
  entity: string,
  entityId?: string | null,
  details: Record<string, unknown> = {},
) {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  } catch {
    // outside a request (bulk job) — no headers
  }
  await prisma.auditLog.create({
    data: { actorId: actorId ?? null, action, entity, entityId: entityId ?? null, details: JSON.stringify(details), ip },
  });
}
