"use client";
import Link from "next/link";
import { LogIn, Phone, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { LanguageToggle, useT } from "@/components/i18n";
import { ORG } from "@/lib/constants";

/** Chrome for the registration wizard and payment result pages (bilingual). */
export function RegisterShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="MSY College home" className="shrink-0">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={`tel:${ORG.phone.replace(/\s/g, "")}`}
              className="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:inline-flex"
            >
              <Phone className="size-4" /> {ORG.phone}
            </a>
            <LanguageToggle />
            <Link
              href="/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-brand-700"
              aria-label={t("reg.login")}
            >
              <LogIn className="size-4" />
              <span className="hidden sm:inline">{t("reg.login")}</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-emerald-600" /> {t("reg.secureNote")}
          </p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>{t("reg.help")}</span>
            <a className="font-medium text-brand-700 hover:underline" href={`tel:${ORG.phone.replace(/\s/g, "")}`}>
              {ORG.phone}
            </a>
            <a className="font-medium text-brand-700 hover:underline" href={`mailto:${ORG.email}`}>
              {ORG.email}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
