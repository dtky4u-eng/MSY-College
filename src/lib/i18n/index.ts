// Bilingual (English + Hindi) support for student-facing flows (NFR-8).
// Use `t("key", { name: "Asha" })` — `{name}` placeholders are interpolated. Missing Hindi keys fall back to English,
// missing English keys fall back to the key itself.
import { common } from "./dict/common";
import { register } from "./dict/register";
import { student } from "./dict/student";

export type Lang = "en" | "hi";
export const LANG_COOKIE = "rk_lang";

const en: Record<string, string> = { ...common.en, ...register.en, ...student.en };
const hi: Record<string, string> = { ...common.hi, ...register.hi, ...student.hi };
const DICTS: Record<Lang, Record<string, string>> = { en, hi };

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): TFn {
  return (key, vars) => {
    let s = DICTS[lang][key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export const normalizeLang = (v: string | undefined | null): Lang => (v === "hi" ? "hi" : "en");
