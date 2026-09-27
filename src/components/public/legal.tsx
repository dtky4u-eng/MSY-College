import Link from "next/link";
import { ORG } from "@/lib/constants";

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

const OTHER = [
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/refund-cancellation-policy", label: "Refund & Cancellation Policy" },
];

/** Shared layout for legal / policy pages with an on-page table of contents. */
export function LegalPage({ title, intro, updated, sections, current }: { title: string; intro: React.ReactNode; updated: string; sections: LegalSection[]; current: string }) {
  return (
    <div className="bg-white">
      <div className="border-b border-slate-200 bg-gradient-to-b from-brand-50/60 to-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">Legal</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-base text-slate-600">{intro}</p>
          <p className="mt-4 text-xs text-slate-500">
            Last updated {updated} · {ORG.name}
          </p>
        </div>
      </div>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">On this page</p>
          <ol className="mt-3 space-y-1.5 text-sm">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-slate-600 hover:text-brand-700">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs font-semibold tracking-wide text-slate-500 uppercase">Other policies</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {OTHER.filter((o) => o.href !== current).map((o) => (
              <li key={o.href}>
                <Link href={o.href} className="text-brand-700 hover:text-brand-800">
                  {o.label}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
        <article className="min-w-0 space-y-10 text-[15px] leading-relaxed text-slate-700 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-xl font-bold text-slate-900">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 space-y-3">{s.body}</div>
            </section>
          ))}
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm">
            <p className="font-semibold text-slate-900">Questions about this policy?</p>
            <p className="mt-1">
              Contact the MSY College helpdesk at{" "}
              <a className="font-medium text-brand-700" href={`mailto:${ORG.email}`}>
                {ORG.email}
              </a>{" "}
              or{" "}
              <a className="font-medium text-brand-700" href={`tel:${ORG.phone.replace(/\s/g, "")}`}>
                {ORG.phone}
              </a>
              .
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
