"use client";
import { useEffect, useState } from "react";
import { Clock, Lock, LogIn, LogOut, TimerReset } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { formatDate, formatTime } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/modal";
import { Alert } from "@/components/ui/page";
import { useT } from "@/components/i18n";
import { formatDuration } from "@/components/student/utils";

interface Row {
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  learningSeconds: number;
}

export function TodayCard({
  today,
  row,
  blockReason,
  locked,
  halfDayBelowHours,
  checkInFrom,
}: {
  today: string;
  row: Row | null;
  blockReason: string | null;
  locked: boolean;
  halfDayBelowHours: number;
  checkInFrom: string;
}) {
  const t = useT();
  const { run, loading } = useAction();
  const [confirm, setConfirm] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const checkedIn = Boolean(row?.checkIn);
  const checkedOut = Boolean(row?.checkOut);

  useEffect(() => {
    if (!checkedIn || checkedOut) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [checkedIn, checkedOut]);

  const elapsed = row?.checkIn ? ((row.checkOut ? new Date(row.checkOut).getTime() : now) - new Date(row.checkIn).getTime()) / 1000 : 0;
  const willBeHalf = elapsed < halfDayBelowHours * 3600;

  const checkIn = () => run(() => api("/api/student/attendance/check-in", { method: "POST" }), { success: t("att.checkedInToast"), refresh: true });
  const checkOut = async () => {
    const r = await run(() => api("/api/student/attendance/check-out", { method: "POST" }), { success: t("att.checkedOutToast"), refresh: true });
    if (r !== undefined) setConfirm(false);
  };

  return (
    <Card className="h-full">
      <CardHeader icon={<Clock className="size-5" />} title={t("att.today")} description={formatDate(today, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} />
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">{t("att.status")}</span>
          {row ? <StatusBadge status={checkedIn && !checkedOut ? "RUNNING" : row.status} label={checkedIn && !checkedOut ? t("att.inProgress") : t(`att.${row.status}`)} /> : <StatusBadge status="NOT_MARKED" label={t("att.NOT_MARKED")} />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t("att.checkIn")}</p>
            <p className="mt-0.5 font-display text-lg font-bold text-slate-900 tabular-nums">{row?.checkIn ? formatTime(row.checkIn) : "—"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t("att.checkOut")}</p>
            <p className="mt-0.5 font-display text-lg font-bold text-slate-900 tabular-nums">{row?.checkOut ? formatTime(row.checkOut) : "—"}</p>
          </div>
        </div>
        {checkedIn && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 text-slate-500">
              <TimerReset className="size-4" /> {t("att.duration")}
            </span>
            <span className="font-semibold text-slate-900 tabular-nums" aria-live="polite">
              {formatDuration(elapsed)}
            </span>
          </div>
        )}

        {locked ? (
          <Alert tone="info" icon={<Lock />}>
            {t("banner.completedAttendance")}
          </Alert>
        ) : blockReason && !checkedIn ? (
          <Alert tone="warning">{blockReason}</Alert>
        ) : !checkedIn ? (
          <Button size="lg" className="w-full" icon={<LogIn className="size-5" />} loading={loading} onClick={checkIn}>
            {t("att.checkInBtn")}
          </Button>
        ) : !checkedOut ? (
          <>
            <Button size="lg" variant="success" className="w-full" icon={<LogOut className="size-5" />} onClick={() => setConfirm(true)} disabled={Boolean(blockReason)}>
              {t("att.checkOutBtn")}
            </Button>
            {blockReason && <Alert tone="warning">{blockReason}</Alert>}
          </>
        ) : (
          <Alert tone="success">{t("att.doneForToday")}</Alert>
        )}
        <p className="text-xs text-slate-500">{t("att.hint", { hours: halfDayBelowHours, time: checkInFrom })}</p>
      </CardBody>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={checkOut}
        loading={loading}
        title={t("att.confirmOutTitle")}
        description={willBeHalf ? t("att.confirmOutHalf", { hours: halfDayBelowHours, elapsed: formatDuration(elapsed) }) : t("att.confirmOutFull", { elapsed: formatDuration(elapsed) })}
        confirmLabel={t("att.checkOutBtn")}
        tone={willBeHalf ? "primary" : "success"}
      />
    </Card>
  );
}
