import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Ban, SearchX, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { ORG } from "@/lib/constants";
import { lookupCertificate } from "@/components/public/certificate-lookup";

export const metadata: Metadata = { title: "Certificate Verification", robots: { index: false } };
export const dynamic = "force-dynamic";

/** NFR-10: target of the certificate QR code — `${APP_URL}/verify/<verifyCode>` (also accepts the certificate number). */
export default async function VerifyResultPage({ params }: { params: Promise<{ code: string[] }> }) {
  const { code } = await params;
  const res = await lookupCertificate(code.join("/"));
  const c = res.certificate;

  const tone =
    res.status === "VALID"
      ? { band: "from-emerald-500 to-teal-600", icon: <BadgeCheck className="size-8" />, title: "Valid certificate", sub: "This certificate was issued by MSY College and is authentic." }
      : res.status === "REVOKED"
        ? { band: "from-rose-500 to-rose-700", icon: <Ban className="size-8" />, title: "Certificate revoked", sub: `This certificate was revoked${c?.revokedAt ? ` on ${formatDate(c.revokedAt)}` : ""} and is no longer valid.` }
        : { band: "from-slate-500 to-slate-700", icon: <SearchX className="size-8" />, title: "Certificate not found", sub: "No MSY College certificate matches this number or code. Check it and try again." };

  const period = c?.internshipStart ? `${formatDate(c.internshipStart)} – ${formatDate(c.internshipEnd)}` : c?.internshipEnd ? `Completed ${formatDate(c.internshipEnd)}` : "—";

  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <div className="overflow-hidden rounded-2xl bg-white shadow-pop ring-1 ring-slate-200">
          <div className={`bg-gradient-to-br ${tone.band} px-6 py-8 text-center text-white`}>
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">{tone.icon}</div>
            <p className="mt-3 text-xs font-semibold tracking-[0.2em] uppercase opacity-80">{res.status.replace("_", " ")}</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{tone.title}</h1>
            <p className="mx-auto mt-1.5 max-w-md text-sm opacity-90">{tone.sub}</p>
          </div>
          {c ? (
            <div className="p-6 sm:p-8">
              <p className="text-xs text-slate-500">Awarded to</p>
              <p className="text-2xl font-bold text-slate-900">{c.studentName}</p>
              <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {(
                  [
                    ["Internship domain", c.domain],
                    ["Grade", c.grade],
                    ["College", c.college],
                    ["University", c.university],
                    ["Internship period", period],
                    ["Hours", c.hours ? `${c.hours} hours` : null],
                    ["Certificate No.", c.certificateNo],
                    ["Issue date", formatDate(c.issuedAt)],
                    ["Registration No.", c.registrationNumber],
                    ["Verification code", c.verifyCode],
                  ] as [string, string | null][]
                ).map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{k}</dt>
                    <dd className="mt-0.5 font-medium break-words text-slate-900">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div className="p-6 text-center sm:p-8">
              <p className="text-sm text-slate-600">
                You searched for <span className="font-mono font-semibold break-all text-slate-900">{res.query || "—"}</span>
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="size-4 text-emerald-600" /> Verified live against {ORG.brand} records
            </p>
            <Link href="/verify" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              Verify another certificate →
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Questions about a certificate? Contact{" "}
          <a href={`mailto:${ORG.email}`} className="font-medium text-brand-700">
            {ORG.email}
          </a>
        </p>
      </div>
    </div>
  );
}
