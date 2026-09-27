// Client-safe helpers shared by the Learning Setup pages, client components and API routes (FR-ADM-8).

export const LEARNING_PATH = "/admin/learning";

export type LearningTab = "resources" | "quiz";

/** Build a /admin/learning URL that keeps the hierarchy selection bookmarkable. */
export function learningHref(sel: { domain?: string | null; module?: string | null; chapter?: string | null; tab?: LearningTab | null; q?: string | null; sector?: string | null; status?: string | null }, hash?: string) {
  const sp = new URLSearchParams();
  if (sel.q) sp.set("q", sel.q);
  if (sel.sector) sp.set("sector", sel.sector);
  if (sel.status) sp.set("status", sel.status);
  if (sel.domain) sp.set("domain", sel.domain);
  if (sel.module) sp.set("module", sel.module);
  if (sel.chapter) sp.set("chapter", sel.chapter);
  if (sel.tab && sel.tab !== "resources") sp.set("tab", sel.tab);
  const qs = sp.toString();
  return `${LEARNING_PATH}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Seconds → minutes with at most two decimals (e.g. 45 → 0.75). */
export function secondsToMinutes(s: number): number {
  return Math.round((s / 60) * 100) / 100;
}

export function minutesLabel(s: number): string {
  if (!s) return "None";
  if (s < 60) return `${s} sec`;
  const m = secondsToMinutes(s);
  return `${m} min`;
}

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export function humanBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Accept strings for each resource type (client picker; the server re-validates by magic bytes). */
export const RESOURCE_ACCEPT: Record<string, string> = {
  VIDEO: ".mp4",
  PDF: ".pdf",
  NOTES: ".pdf,.doc,.docx,.txt",
  CODE: ".zip,.txt",
  LINK: "",
  OTHER: ".pdf,.doc,.docx,.ppt,.pptx,.zip,.txt,.mp4,.jpg,.jpeg,.png,.webp,.xlsx",
};
