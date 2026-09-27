import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QrCode, Search, ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Verify Certificate", description: "Verify an MSY College internship certificate by its certificate number or verification code." };

/** G-3: public certificate verification entry point (works without JavaScript). */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string; empty?: string }> }) {
  const sp = await searchParams;
  const code = sp.code?.trim();
  if (code) redirect(`/verify/${encodeURIComponent(code.slice(0, 80))}`);
  const empty = sp.code !== undefined && !code;

  return (
    <div className="bg-gradient-to-b from-brand-50/60 to-white">
      <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Verify a certificate</h1>
          <p className="mt-3 text-slate-600">Enter the certificate number or the verification code printed below the QR code on an MSY College internship certificate.</p>
        </div>
        <form action="/verify" method="get" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-700">
            Certificate number or verification code
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="code"
              name="code"
              required
              maxLength={80}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="e.g. MSY/CERT/2026/000001 or MSYDEMO2026"
              aria-invalid={empty}
              aria-describedby={empty ? "code-err" : undefined}
              className="h-12 flex-1 rounded-xl border border-slate-300 px-4 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none"
            />
            <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
              <Search className="size-4" /> Verify
            </button>
          </div>
          {empty && (
            <p id="code-err" className="mt-2 text-xs font-medium text-rose-600">
              Enter a certificate number or verification code.
            </p>
          )}
          <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
            <QrCode className="mt-0.5 size-4 shrink-0" /> Scanning the QR code on the certificate opens its verification page directly.
          </p>
        </form>
      </div>
    </div>
  );
}
