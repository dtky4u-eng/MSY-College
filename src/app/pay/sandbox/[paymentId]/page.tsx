import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { assertPaymentAccess } from "@/lib/registration";
import { ORG } from "@/lib/constants";
import { SandboxCheckout } from "./sandbox-checkout";

export const metadata: Metadata = { title: "Sandbox Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Mock hosted checkout used when no live gateway keys are configured (local development / demos). */
export default async function SandboxPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { student: { select: { name: true, email: true, mobile: true, domain: { select: { name: true } } } } },
  });

  let problem: string | null = null;
  if (!payment || payment.gateway !== "SANDBOX") problem = "This sandbox order does not exist.";
  else {
    try {
      await assertPaymentAccess(payment);
    } catch (e) {
      problem = e instanceof ApiError && e.status === 401 ? "Your registration session has expired. Return to registration and verify again." : "You do not have access to this order.";
    }
  }

  if (problem || !payment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-pop">
          <p className="text-lg font-semibold text-slate-900">Checkout unavailable</p>
          <p className="mt-2 text-sm text-slate-600">{problem}</p>
          <Link href="/register" className="mt-5 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
            Back to registration
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SandboxCheckout
      payment={{
        id: payment.id,
        orderId: payment.orderId ?? "",
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status,
        description: `${payment.student.domain?.name ?? "Internship"} — internship fee`,
        customer: { name: payment.student.name, email: payment.student.email ?? "", mobile: payment.student.mobile ?? "" },
      }}
      merchant={ORG.name}
    />
  );
}
