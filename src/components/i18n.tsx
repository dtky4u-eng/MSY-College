"use client";
import { createContext, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LANG_COOKIE, makeT, type Lang, type TFn } from "@/lib/i18n";
import { cn } from "@/components/ui/cn";

const Ctx = createContext<{ lang: Lang; t: TFn }>({ lang: "en", t: makeT("en") });

/** Wrap student-facing trees. `lang` comes from getLang() on the server. */
export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx).t;
}

export function useLang() {
  return useContext(Ctx).lang;
}

export function LanguageToggle({ className, compact }: { className?: string; compact?: boolean }) {
  const { lang } = useContext(Ctx);
  const router = useRouter();
  const next: Lang = lang === "en" ? "hi" : "en";
  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700",
        className,
      )}
      aria-label={next === "hi" ? "हिन्दी में देखें" : "View in English"}
    >
      <Languages className="size-4" />
      {!compact && <span>{next === "hi" ? "हिन्दी" : "English"}</span>}
    </button>
  );
}
