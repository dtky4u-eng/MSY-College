// Student self-registration context (FR-REG, §4.2).
// The wizard runs before the student can sign in, so its context lives in a short-lived, httpOnly
// signed cookie (REG_COOKIE) that carries the student id. Every /api/register/* endpoint calls
// requireRegStudent() which rejects a missing / expired / tampered cookie.
import "server-only";
import { cookies } from "next/headers";
import type { Payment } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./http";
import { getAuth } from "./auth";
import { REG_COOKIE, REG_TTL_SECONDS, signRegToken, verifyRegToken } from "./jwt";
import { domainsWithFees } from "./fees";
import { toISTDateString } from "./format";
import type { VerifyResult } from "./payments";
import type { PaymentOutcome, RegFile, RegOption, RegState } from "@/components/register/types";

const secure = () => (process.env.APP_URL ?? "").startsWith("https://");

/** Registration numbers are matched upper-cased with all whitespace removed. */
export function normaliseRegNo(v: string): string {
  return v.toUpperCase().replace(/\s+/g, "");
}

export async function setRegCookie(studentId: string) {
  const token = await signRegToken(studentId, true);
  (await cookies()).set(REG_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: REG_TTL_SECONDS });
}

export async function clearRegCookie() {
  (await cookies()).delete(REG_COOKIE);
}

/** Current registration context from the cookie (null when missing/expired/unverified). */
export async function getRegSession(): Promise<{ studentId: string } | null> {
  const reg = await verifyRegToken((await cookies()).get(REG_COOKIE)?.value);
  if (!reg || !reg.verified) return null;
  return { studentId: reg.studentId };
}

const regInclude = { college: true, domain: true, user: true } as const;

export type RegStudent = NonNullable<Awaited<ReturnType<typeof loadRegStudent>>>;

export function loadRegStudent(studentId: string) {
  return prisma.student.findUnique({ where: { id: studentId }, include: regInclude });
}

/** API guard for the wizard: throws 401 when the registration session is missing or expired. */
export async function requireRegStudent(): Promise<RegStudent> {
  const ctx = await getRegSession();
  const student = ctx ? await loadRegStudent(ctx.studentId) : null;
  if (!student) {
    throw new ApiError(401, "Your registration session has expired. Please verify your registration number again.", { code: "SESSION_EXPIRED" });
  }
  if (student.college.status !== "ACTIVE" && student.paymentStatus !== "PAID") {
    throw new ApiError(403, "Your college's onboarding with MSY College is not active. Please contact your college.", { code: "COLLEGE_INACTIVE" });
  }
  return student;
}

/** Steps 2–4 are editable only until the registration is confirmed (FR-REG-1, NFR-4). */
export function assertEditable(student: RegStudent) {
  if (student.paymentStatus === "PAID") throw new ApiError(409, "Payment already completed. Please sign in.", { code: "PAID" });
  if (student.registrationLocked) {
    throw new ApiError(409, "Your registration is confirmed and locked. Details and documents can no longer be changed.", { code: "LOCKED" });
  }
}

/** Steps must be completed in order. */
export function assertReached(student: RegStudent, step: number) {
  if (student.nextStep < step) throw new ApiError(409, "Please complete the previous steps first.", { code: "STEP_ORDER" });
}

async function fileMeta(id: string | null): Promise<RegFile | null> {
  if (!id) return null;
  const f = await prisma.fileObject.findUnique({ where: { id } });
  return f ? { name: f.originalName, size: f.size, mime: f.mime, uploadedAt: f.createdAt.toISOString() } : null;
}

async function options(type: string, current: string | null): Promise<RegOption[]> {
  const rows = await prisma.masterOption.findMany({ where: { type, active: true }, orderBy: [{ sort: "asc" }, { label: "asc" }] });
  const list = rows.map((r) => ({ value: r.value, label: r.label }));
  // Keep the value from the college record selectable even if the option was retired later.
  if (current && !list.some((o) => o.value === current)) list.unshift({ value: current, label: current });
  return list;
}

/** Everything the wizard needs to render, for the student in the registration cookie. */
export async function buildRegState(studentId: string): Promise<RegState | null> {
  const s = await loadRegStudent(studentId);
  if (!s) return null;
  const [photo, admitCard, programmes, sessions, semesters, domains, last, success] = await Promise.all([
    fileMeta(s.photoFileId),
    fileMeta(s.admitCardFileId),
    options("PROGRAMME", s.programme),
    options("SESSION", s.session),
    options("SEMESTER", s.semester),
    domainsWithFees(s.collegeId),
    prisma.payment.findFirst({ where: { studentId }, orderBy: { createdAt: "desc" } }),
    prisma.payment.findFirst({ where: { studentId, status: "SUCCESS" }, orderBy: { paidAt: "desc" }, select: { id: true } }),
  ]);
  return {
    student: {
      name: s.name,
      registrationNumber: s.registrationNumber,
      college: { name: s.college.name, university: s.college.university, code: s.college.code },
      fatherName: s.fatherName ?? "",
      gender: s.gender ?? "",
      dob: s.dob ? toISTDateString(s.dob) : "",
      programme: s.programme ?? "",
      majorSubject: s.majorSubject ?? "",
      session: s.session ?? "",
      semester: s.semester ?? "",
      mobile: s.mobile ?? "",
      email: s.user?.email ?? s.email ?? "",
      username: s.user?.username ?? "",
      hasAccount: Boolean(s.userId),
      domainId: s.domainId,
      feeAmount: s.feeAmount,
      photo,
      admitCard,
      nextStep: s.nextStep,
      locked: s.registrationLocked,
      lockedAt: s.lockedAt?.toISOString() ?? null,
      paid: s.paymentStatus === "PAID",
      portalRegNo: s.paymentStatus === "PAID" ? s.portalRegNo : null,
    },
    options: { programmes, sessions, semesters },
    domains: domains.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      description: d.description,
      sector: d.sector.name,
      durationHours: d.durationHours,
      fee: d.fee,
      customFee: d.customFee,
    })),
    lastPayment: last
      ? { id: last.id, status: last.status, transactionId: last.transactionId, amount: last.amount, failureReason: last.failureReason, createdAt: last.createdAt.toISOString() }
      : null,
    successPaymentId: success?.id ?? null,
  };
}

export async function regStateOrThrow(studentId: string): Promise<RegState> {
  const state = await buildRegState(studentId);
  if (!state) throw new ApiError(404, "Registration not found");
  return state;
}

/**
 * Payment access (verify/status/sandbox): the student in the registration cookie, the signed-in
 * student who owns the payment, or an admin. Throws 401/403 otherwise.
 */
export async function assertPaymentAccess(payment: Pick<Payment, "studentId">) {
  const reg = await getRegSession();
  if (reg?.studentId === payment.studentId) return;
  const auth = await getAuth();
  if (auth?.user.role === "ADMIN") return;
  if (auth?.user.role === "STUDENT") {
    const own = await prisma.student.findFirst({ where: { id: payment.studentId, userId: auth.user.id }, select: { id: true } });
    if (own) return;
  }
  throw new ApiError(auth || reg ? 403 : 401, auth || reg ? "You do not have access to this payment." : "Your registration session has expired. Please verify again.", {
    code: auth || reg ? "FORBIDDEN" : "SESSION_EXPIRED",
  });
}

/** Client-facing view of a verification / status result. */
export async function paymentOutcome(result: VerifyResult): Promise<PaymentOutcome> {
  const p = result.payment;
  const s = await prisma.student.findUnique({
    where: { id: p.studentId },
    select: { name: true, portalRegNo: true, paymentStatus: true, user: { select: { username: true } }, domain: { select: { name: true } } },
  });
  return {
    status: result.status,
    message: result.message ?? null,
    payment: {
      id: p.id,
      transactionId: p.transactionId,
      amount: p.amount,
      gateway: p.gateway,
      gatewayPaymentId: p.gatewayPaymentId,
      failureReason: p.failureReason,
      receiptNo: p.receiptNo,
      paidAt: p.paidAt?.toISOString() ?? null,
    },
    student: {
      name: s?.name ?? "",
      portalRegNo: s?.paymentStatus === "PAID" ? (s.portalRegNo ?? null) : null,
      username: s?.user?.username ?? null,
      domainName: s?.domain?.name ?? null,
    },
  };
}
