import { ShieldCheck } from "lucide-react";
import { requirePageRole } from "@/lib/auth";
import { STUDENT_STATUS } from "@/lib/constants";
import { Alert, PageHeader } from "@/components/ui/page";
import { studentFilterOptions } from "@/components/admin/ops/lookups";
import { listJobs } from "@/app/api/admin/bulk/_shared";
import { BulkCenter } from "./bulk-center";
import { JobsPanel } from "./jobs-panel";

export const metadata = { title: "Bulk Automation Center" };

export default async function BulkPage() {
  await requirePageRole("ADMIN");
  const [opts, jobs] = await Promise.all([studentFilterOptions(), listJobs()]);
  return (
    <>
      <PageHeader
        title="Bulk Automation Center"
        description="Run lifecycle steps and document generation for many students at once. Filter students, preview the impact, then run a tracked background job that you can cancel or retry."
      />
      <Alert tone="info" icon={<ShieldCheck />} title="Generated records are always distinguishable" className="mb-6">
        Attendance, logbook entries, quiz attempts, assessments and submissions created here are flagged as <b>generated</b>, stored with the job&apos;s reason, and every job is recorded in the audit log. Operations that create records require a reason and typing the confirmation word. Generation applies only to paid students whose internship has started.
      </Alert>
      <BulkCenter options={{ ...opts, statuses: STUDENT_STATUS.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })) }} />
      <JobsPanel initial={jobs} />
    </>
  );
}
