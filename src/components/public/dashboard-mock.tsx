import {
  BookOpen,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  FolderKanban,
  LayoutDashboard,
  NotebookPen,
  UserCircle,
} from "lucide-react";

// Mirrors the real student portal menu (G-8) — keep in sync with components/portal/nav.ts.
const MENU = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Learning Modules", icon: BookOpen },
  { label: "Attendance", icon: CalendarCheck },
  { label: "Log Book", icon: NotebookPen },
  { label: "Assignments", icon: ClipboardList },
  { label: "Live Project", icon: FolderKanban },
  { label: "Internship Report", icon: FileText },
  { label: "Routine", icon: CalendarClock },
  { label: "Download Center", icon: Download },
  { label: "My Profile", icon: UserCircle },
];

/** Illustrative product mock of the student dashboard (decorative). */
export function DashboardMock() {
  return (
    <div aria-hidden className="relative select-none">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-brand-500/30 via-violet-400/20 to-amber-300/30 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white shadow-2xl shadow-brand-950/20 ring-1 ring-slate-900/5">
        <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 truncate rounded-md bg-white px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-200">msycollege.org/student</span>
        </div>
        <div className="grid grid-cols-[132px_1fr] sm:grid-cols-[156px_1fr]">
          <div className="border-r border-slate-100 bg-slate-950 p-2.5 text-[10.5px] sm:text-[11px]">
            <p className="mb-2 px-2 pt-1 font-bold text-white">
              MSY <span className="text-accent-400">College</span>
            </p>
            <ul className="space-y-0.5">
              {MENU.map((m, i) => (
                <li key={m.label} className={`flex items-center gap-1.5 truncate rounded-md px-2 py-1.5 ${i === 0 ? "bg-brand-600 text-white" : "text-slate-400"}`}>
                  <m.icon className="size-3 shrink-0" /> {m.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3 bg-slate-50 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-500">Welcome back</p>
                <p className="text-sm font-bold text-slate-900">Internship Dashboard</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Active</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Course", "68%"],
                ["Attendance", "92%"],
                ["Hours left", "38"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                  <p className="text-[9.5px] text-slate-500">{k}</p>
                  <p className="text-sm font-bold text-slate-900">{v}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
              <p className="text-[10.5px] font-semibold text-slate-700">Overall progress</p>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                <div className="h-2 w-[68%] rounded-full bg-gradient-to-r from-brand-500 to-violet-500" />
              </div>
              <div className="mt-2.5 flex h-14 items-end gap-1">
                {[35, 55, 40, 70, 60, 85, 75, 90, 65, 80].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-brand-200" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              {["Module 3 · Chapter 2 unlocked", "Logbook entry saved", "Assignment approved by mentor"].map((x) => (
                <div key={x} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[10.5px] text-slate-600 ring-1 ring-slate-200">
                  <span className="size-1.5 rounded-full bg-brand-500" /> {x}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
