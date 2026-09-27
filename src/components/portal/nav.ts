import {
  BarChart3,
  Banknote,
  BookOpen,
  BookOpenCheck,
  Building2,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Library,
  ListChecks,
  NotebookPen,
  PlayCircle,
  RotateCcw,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCircle,
  UserCog,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
  tKey?: string; // i18n key for student portal
  icon: LucideIcon;
  exact?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV: Record<Role, NavSection[]> = {
  STUDENT: [
    {
      items: [
        { href: "/student", label: "Dashboard", tKey: "nav.dashboard", icon: LayoutDashboard, exact: true },
        { href: "/student/learning", label: "Learning Modules", tKey: "nav.learning", icon: BookOpen },
        { href: "/student/attendance", label: "Attendance", tKey: "nav.attendance", icon: CalendarCheck },
        { href: "/student/logbook", label: "Log Book", tKey: "nav.logbook", icon: NotebookPen },
        { href: "/student/assignments", label: "Assignments", tKey: "nav.assignments", icon: ClipboardList },
        { href: "/student/live-project", label: "Live Project", tKey: "nav.liveProject", icon: FolderKanban },
        { href: "/student/report", label: "Internship Report", tKey: "nav.report", icon: FileText },
        { href: "/student/routine", label: "Routine", tKey: "nav.routine", icon: CalendarClock },
        { href: "/student/downloads", label: "Download Center", tKey: "nav.downloads", icon: Download },
        { href: "/student/profile", label: "My Profile", tKey: "nav.profile", icon: UserCircle },
      ],
    },
  ],
  COLLEGE: [
    {
      items: [
        { href: "/college", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/college/upload", label: "Upload Students", icon: FileSpreadsheet },
        { href: "/college/registrations", label: "Registrations", icon: ClipboardCheck },
        { href: "/college/students", label: "Students & Certificates", icon: GraduationCap },
        { href: "/college/payments", label: "My Payments", icon: Banknote },
        { href: "/college/profile", label: "College Profile", icon: Building2 },
      ],
    },
  ],
  MENTOR: [
    {
      items: [
        { href: "/mentor", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/mentor/students", label: "Assigned Students", icon: Users },
        { href: "/mentor/resources", label: "Learning Resources", icon: Library },
        { href: "/mentor/quizzes", label: "Quizzes", icon: ListChecks },
        { href: "/mentor/quiz-reattempts", label: "Quiz Reattempts", icon: RotateCcw },
        { href: "/mentor/reviews", label: "Submission Reviews", icon: FileCheck2 },
        { href: "/mentor/assessments", label: "Student Assessment", icon: BookOpenCheck },
      ],
    },
  ],
  ADMIN: [
    {
      items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
    },
    {
      title: "People",
      items: [
        { href: "/admin/students", label: "Students", icon: GraduationCap },
        { href: "/admin/internships", label: "Internships", icon: PlayCircle },
        { href: "/admin/colleges", label: "Colleges", icon: Building2 },
        { href: "/admin/mentors", label: "Mentors", icon: UserCog },
      ],
    },
    {
      title: "Delivery",
      items: [
        { href: "/admin/learning", label: "Learning Setup", icon: BookOpen },
        { href: "/admin/live-classes", label: "Live Classes", icon: PlayCircle },
        { href: "/admin/routines", label: "Routines", icon: CalendarClock },
        { href: "/admin/quiz-reattempts", label: "Quiz Reattempts", icon: RotateCcw },
        { href: "/admin/bulk", label: "Bulk Automation", icon: Workflow },
      ],
    },
    {
      title: "Finance",
      items: [
        { href: "/admin/payments", label: "Payments", icon: CreditCard },
        { href: "/admin/college-payments", label: "College Settlements", icon: Banknote },
      ],
    },
    {
      title: "Insights",
      items: [
        { href: "/admin/reports", label: "Reports & Analytics", icon: BarChart3 },
        { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
        { href: "/admin/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
};

export const PORTAL_TITLE: Record<Role, string> = {
  STUDENT: "Student Portal",
  COLLEGE: "College Portal",
  MENTOR: "Mentor Portal",
  ADMIN: "Admin Console",
};

export const PORTAL_ICON = ShieldCheck;
