import { cn } from "./cn";

export type Tone = "gray" | "brand" | "green" | "amber" | "red" | "blue" | "violet" | "teal";

const tones: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
};

const dots: Record<Tone, string> = {
  gray: "bg-slate-400",
  brand: "bg-brand-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  blue: "bg-sky-500",
  violet: "bg-violet-500",
  teal: "bg-teal-500",
};

export function Badge({ tone = "gray", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

/** Status → [label, tone] for every status value used in the system. */
const STATUS: Record<string, [string, Tone]> = {
  // student / internship
  PENDING: ["Pending", "amber"],
  ACTIVE: ["Active", "green"],
  COMPLETED: ["Completed", "brand"],
  BLOCKED: ["Blocked", "red"],
  WAITING: ["Waiting to Start", "amber"],
  NOT_STARTED: ["Not Started", "blue"],
  // payment
  UNPAID: ["Unpaid", "gray"],
  PAID: ["Paid", "green"],
  CREATED: ["Created", "gray"],
  SUCCESS: ["Success", "green"],
  FAILED: ["Failed", "red"],
  REFUNDED: ["Refunded", "violet"],
  VERIFY_FAILED: ["Verification Failed", "red"],
  // attendance
  PRESENT: ["Present", "green"],
  HALF_DAY: ["Half Day", "amber"],
  ABSENT: ["Absent", "red"],
  LEAVE: ["Approved Leave", "blue"],
  NOT_MARKED: ["Not Marked", "gray"],
  // submissions
  APPROVED: ["Approved", "green"],
  RESUBMIT: ["Resubmission Requested", "red"],
  PENDING_REVIEW: ["Pending Review", "amber"],
  // jobs
  QUEUED: ["Queued", "gray"],
  RUNNING: ["Running", "blue"],
  CANCELLED: ["Cancelled", "gray"],
  // results
  PASS: ["Pass", "green"],
  FAIL: ["Fail", "red"],
  // college
  INACTIVE: ["Inactive", "gray"],
};

export function StatusBadge({ status, label, className }: { status: string | null | undefined; label?: string; className?: string }) {
  if (!status) return <Badge className={className}>—</Badge>;
  const [l, tone] = STATUS[status] ?? [status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), "gray" as Tone];
  return (
    <Badge tone={tone} dot className={className}>
      {label ?? l}
    </Badge>
  );
}
