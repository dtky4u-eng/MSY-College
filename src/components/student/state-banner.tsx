// FR-STU-2: access-state banner shown on student pages (server component).
import { Ban, CalendarClock, CheckCircle2, Hourglass } from "lucide-react";
import { Alert } from "@/components/ui/page";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/format";
import type { AccessState } from "@/lib/constants";

export async function StateBanner({
  state,
  student,
  context = "general",
  className,
}: {
  state: AccessState;
  student: { internshipStart: Date | null; internshipEnd?: Date | null; blockedReason?: string | null; completedAt?: Date | null };
  /** "attendance" | "learning" | "submissions" tweak the wording for the page. */
  context?: "general" | "attendance" | "learning" | "submissions" | "logbook";
  className?: string;
}) {
  if (state === "ACTIVE") return null;
  const t = await getT();
  const cls = className ?? "mb-6";
  if (state === "WAITING")
    return (
      <Alert tone="warning" icon={<Hourglass />} title={t("state.WAITING")} className={cls}>
        {t("banner.waiting")}
      </Alert>
    );
  if (state === "NOT_STARTED")
    return (
      <Alert tone="info" icon={<CalendarClock />} title={t("state.NOT_STARTED")} className={cls}>
        {t("banner.notStarted", { date: formatDate(student.internshipStart) })}
      </Alert>
    );
  if (state === "COMPLETED")
    return (
      <Alert tone="success" icon={<CheckCircle2 />} title={t("state.COMPLETED")} className={cls}>
        {context === "attendance" ? t("banner.completedAttendance") : t("banner.completed", { date: formatDate(student.completedAt ?? student.internshipEnd ?? null) })}
      </Alert>
    );
  return (
    <Alert tone="error" icon={<Ban />} title={t("state.BLOCKED")} className={cls}>
      {student.blockedReason ? t("banner.blockedReason", { reason: student.blockedReason }) : t("banner.blocked")}
    </Alert>
  );
}
