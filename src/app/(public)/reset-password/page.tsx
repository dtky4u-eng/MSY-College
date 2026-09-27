import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole, TimerOff } from "lucide-react";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/auth";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset Password", robots: { index: false } };
export const dynamic = "force-dynamic";

/** AR-4: choose a new password from an emailed link. The token is pre-checked so an expired link shows a clear message. */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const reset = token && token.length >= 10 ? await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) }, select: { usedAt: true, expiresAt: true } }) : null;
  const valid = Boolean(reset && !reset.usedAt && reset.expiresAt > new Date());

  return (
    <div className="bg-gradient-to-b from-brand-50/60 to-white">
      <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
        {valid ? (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <LockKeyhole className="size-7" />
              </div>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">Choose a new password</h1>
              <p className="mt-2 text-sm text-slate-600">Use at least 8 characters. You&apos;ll be signed out on all devices.</p>
            </div>
            <ResetForm token={token!} />
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <TimerOff className="size-7" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">This link is invalid or has expired</h1>
            <p className="mt-2 text-sm text-slate-600">Reset links are valid for 30 minutes and can be used only once. Request a new link to continue.</p>
            <Link href="/forgot-password" className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
              Request a new link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
