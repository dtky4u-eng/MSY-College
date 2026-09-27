import "server-only";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/http";

export const REASON_MIN = 10;

export async function loadPayment(id: string) {
  const payment = await prisma.payment.findUnique({ where: { id }, include: { student: { select: { id: true, name: true, userId: true, paymentStatus: true, feeAmount: true } } } });
  if (!payment) throw notFound("Payment not found");
  return payment;
}

/** Full detail used by the admin payment drawer. */
export async function paymentDetail(id: string) {
  const p = await prisma.payment.findUnique({
    where: { id },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          registrationNumber: true,
          portalRegNo: true,
          email: true,
          mobile: true,
          paymentStatus: true,
          feeAmount: true,
          status: true,
          college: { select: { name: true, code: true } },
          domain: { select: { name: true } },
        },
      },
    },
  });
  if (!p) throw notFound("Payment not found");
  const [markedBy, history, otherSuccess] = await Promise.all([
    p.markedById ? prisma.user.findUnique({ where: { id: p.markedById }, select: { username: true } }) : null,
    prisma.auditLog.findMany({
      where: { entity: "Payment", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { username: true } } },
    }),
    prisma.payment.findFirst({ where: { studentId: p.studentId, status: "SUCCESS", id: { not: id } }, select: { transactionId: true } }),
  ]);
  return {
    payment: {
      id: p.id,
      transactionId: p.transactionId,
      gateway: p.gateway,
      orderId: p.orderId,
      gatewayPaymentId: p.gatewayPaymentId,
      gatewaySignature: p.gatewaySignature,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      status: p.status,
      failureReason: p.failureReason,
      paidAt: p.paidAt?.toISOString() ?? null,
      receiptNo: p.receiptNo,
      receiptGeneratedAt: p.receiptGeneratedAt?.toISOString() ?? null,
      manualReason: p.manualReason,
      markedBy: markedBy?.username ?? null,
      raw: p.raw,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    },
    student: {
      id: p.student.id,
      name: p.student.name,
      registrationNumber: p.student.registrationNumber,
      portalRegNo: p.student.portalRegNo,
      email: p.student.email,
      mobile: p.student.mobile,
      paymentStatus: p.student.paymentStatus,
      status: p.student.status,
      feeAmount: p.student.feeAmount,
      college: `${p.student.college.name} (${p.student.college.code})`,
      domain: p.student.domain?.name ?? null,
    },
    otherSuccessTxn: otherSuccess?.transactionId ?? null,
    history: history.map((h) => ({ id: h.id, action: h.action, actor: h.actor?.username ?? "System", at: h.createdAt.toISOString(), details: h.details })),
  };
}

export type PaymentDetail = Awaited<ReturnType<typeof paymentDetail>>;
