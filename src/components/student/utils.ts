// Small helpers shared by student server pages, API routes and client components.
import { toISTDateString } from "@/lib/format";

/** A submission is late when it lands after the due date's IST calendar day. */
export function isLate(submittedAt: Date | string, dueDate: Date | string): boolean {
  return toISTDateString(new Date(submittedAt)) > toISTDateString(new Date(dueDate));
}

/** YouTube watch / share / embed / shorts URL → privacy-enhanced embed URL, or null when not YouTube. */
export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{6,})/);
      id = m?.[2] ?? null;
    }
  }
  if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
}

/** Seconds → "1h 05m" / "4m 30s" / "45s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export const ACCEPT = {
  submission: ".pdf,.doc,.docx,.ppt,.pptx,.zip",
  report: ".pdf,.doc,.docx",
  image: ".jpg,.jpeg,.png,.webp",
};
