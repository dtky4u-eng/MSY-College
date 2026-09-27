"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "./nav-links";

/** Mobile navigation drawer for the public header. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex size-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 animate-fade-in bg-slate-900/30" onClick={() => setOpen(false)}>
          <nav
            id="mobile-nav"
            className="animate-slide-up border-b border-slate-200 bg-white px-4 pt-2 pb-5 shadow-pop"
            onClick={(e) => e.stopPropagation()}
            aria-label="Main"
          >
            <ul className="divide-y divide-slate-100">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} onClick={() => setOpen(false)} className="block py-3 text-base font-medium text-slate-800">
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/verify" className="block py-3 text-base font-medium text-slate-800">
                  Verify Certificate
                </Link>
              </li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link href="/login" className="flex h-11 items-center justify-center rounded-xl border border-slate-300 text-sm font-semibold text-slate-800">
                Login
              </Link>
              <Link href="/register" className="flex h-11 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">
                Apply for Internship
              </Link>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
