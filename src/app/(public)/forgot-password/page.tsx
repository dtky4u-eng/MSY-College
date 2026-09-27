import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot Password" };

/** AR-4: request a password reset link. */
export default function ForgotPasswordPage() {
  return (
    <div className="bg-gradient-to-b from-brand-50/60 to-white">
      <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <KeyRound className="size-7" />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">Forgot your password?</h1>
          <p className="mt-2 text-sm text-slate-600">Enter your username, email or MSY College registration number. We&apos;ll email a reset link to your registered email address.</p>
        </div>
        <ForgotForm devOutbox={process.env.NODE_ENV === "development"} />
      </div>
    </div>
  );
}
