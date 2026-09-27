"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu, UserCircle, X } from "lucide-react";
import type { Role } from "@/lib/constants";
import { ROLE_LABEL } from "@/lib/constants";
import { NAV, PORTAL_TITLE } from "./nav";
import { cn } from "@/components/ui/cn";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/brand";
import { useT } from "@/components/i18n";
import { NotificationBell } from "./notification-bell";

export interface ShellUser {
  name: string;
  subtitle?: string | null;
  photoUrl?: string | null;
}

export function PortalShell({
  role,
  user,
  topbarExtra,
  sidebarFooter,
  children,
}: {
  role: Role;
  user: ShellUser;
  topbarExtra?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = useT();
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const label = (i: { label: string; tKey?: string }) => (role === "STUDENT" && i.tKey ? (t(i.tKey) === i.tKey ? i.label : t(i.tKey)) : i.label);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href={`/${role.toLowerCase()}`} className="flex items-center gap-2">
          <Logo className="size-8" />
          <div className="leading-tight">
            <div className="font-display text-[15px] font-bold text-slate-900">MSY College</div>
            <div className="text-[11px] font-medium text-slate-500">{PORTAL_TITLE[role]}</div>
          </div>
        </Link>
        <button className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3 scrollbar-thin">
        {NAV[role].map((section, si) => (
          <div key={si}>
            {section.title && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{section.title}</p>}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, item.exact);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      )}
                    >
                      <Icon className={cn("size-[18px] shrink-0", active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600")} />
                      <span className="truncate">{label(item)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {sidebarFooter && <div className="border-t border-slate-100 p-3">{sidebarFooter}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-slide-up bg-white shadow-pop">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6">
          <button className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 lg:hidden">{PORTAL_TITLE[role]}</p>
          </div>
          <div className="flex items-center gap-2">
            {topbarExtra}
            <NotificationBell />
            <UserMenu role={role} user={user} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({ role, user }: { role: Role; user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const profileHref = role === "STUDENT" ? "/student/profile" : role === "COLLEGE" ? "/college/profile" : role === "ADMIN" ? "/admin/settings" : null;
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100" aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={user.name} src={user.photoUrl} size={32} />
        <div className="hidden text-left leading-tight md:block">
          <div className="max-w-[160px] truncate text-sm font-semibold text-slate-900">{user.name}</div>
          <div className="max-w-[160px] truncate text-[11px] text-slate-500">{user.subtitle ?? ROLE_LABEL[role]}</div>
        </div>
        <ChevronDown className="hidden size-4 text-slate-400 md:block" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 animate-fade-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop" role="menu">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.subtitle ?? ROLE_LABEL[role]}</p>
          </div>
          {profileHref && (
            <Link href={profileHref} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" onClick={() => setOpen(false)}>
              <UserCircle className="size-4 text-slate-400" /> {role === "STUDENT" ? (t("nav.profile") === "nav.profile" ? "My Profile" : t("nav.profile")) : role === "ADMIN" ? "Settings" : "Profile"}
            </Link>
          )}
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
            <LogOut className="size-4" /> {t("action.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
