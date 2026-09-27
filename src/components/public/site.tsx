import Link from "next/link";
import { BadgeCheck, Mail, MapPin, Phone } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { ORG } from "@/lib/constants";
import { MobileMenu } from "./mobile-menu";
import { NAV_LINKS } from "./nav-links";

export const TEL = `tel:${ORG.phone.replace(/\s/g, "")}`;
export const MAILTO = `mailto:${ORG.email}`;

/** Sticky public header with anchors, Verify Certificate, Login and the primary CTA. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="MSY College home" className="shrink-0">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/verify"
            className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 md:inline-flex"
          >
            <BadgeCheck className="size-4 text-emerald-600" /> Verify Certificate
          </Link>
          <Link href="/login" className="hidden h-9 items-center rounded-lg border border-slate-300 px-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:inline-flex">
            Login
          </Link>
          <Link
            href="/register"
            className="hidden h-9 items-center rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700 sm:inline-flex"
          >
            Apply for Internship
          </Link>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

const FOOTER_COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Students",
    links: [
      { label: "Apply for Internship", href: "/register" },
      { label: "Track Application", href: "/register" },
      { label: "Student Login", href: "/login" },
      { label: "Forgot Password", href: "/forgot-password" },
      { label: "Verify Certificate", href: "/verify" },
    ],
  },
  {
    title: "Colleges",
    links: [
      { label: "College Login", href: "/login" },
      { label: "Register College", href: "/#partner" },
      { label: "Upload Students", href: "/login" },
      { label: "Resources", href: "/#domains" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/#about" },
      { label: "Internship Process", href: "/#process" },
      { label: "NEP 2020", href: "/#nep" },
      { label: "Contact", href: "/#contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms & Conditions", href: "/terms-and-conditions" },
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Refund & Cancellation", href: "/refund-cancellation-policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Wordmark light />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              {ORG.name} runs NEP 2020 / CBCS internships end to end — college-verified registration, learning, attendance, mentor assessment and QR-verified
              certificates.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li>
                <a href={TEL} className="inline-flex items-center gap-2 hover:text-white">
                  <Phone className="size-4" /> {ORG.phone}
                </a>
              </li>
              <li>
                <a href={MAILTO} className="inline-flex items-center gap-2 hover:text-white">
                  <Mail className="size-4" /> {ORG.email}
                </a>
              </li>
              <li className="inline-flex items-center gap-2">
                <MapPin className="size-4" /> {ORG.address}
              </li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_COLS.map((c) => (
              <div key={c.title}>
                <p className="text-sm font-semibold text-white">{c.title}</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {ORG.name}. All rights reserved.
          </p>
          <p>MSME Registered · MCA Incorporated · ISO 9001:2015 · Aligned with AICTE guidelines</p>
        </div>
      </div>
    </footer>
  );
}

/** Header + content + footer for public pages. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
