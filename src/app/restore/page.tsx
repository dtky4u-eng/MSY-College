"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/brand";

function Restore() {
  const sp = useSearchParams();
  useEffect(() => {
    const raw = sp.get("next") ?? "/";
    const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
    fetch("/api/auth/refresh", { method: "POST" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok) window.location.replace(next.startsWith(j.data.home) ? next : j.data.home);
        else window.location.replace(`/login?next=${encodeURIComponent(next)}&expired=1`);
      })
      .catch(() => window.location.replace(`/login?next=${encodeURIComponent(next)}`));
  }, [sp]);
  return null;
}

/** AR-2: shown while an expired access token is refreshed. */
export default function RestorePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <Logo className="size-12" />
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <Loader2 className="size-4 animate-spin text-brand-600" /> Restoring session…
      </div>
      <Suspense>
        <Restore />
      </Suspense>
    </div>
  );
}
