import { FolderKanban, ImageIcon, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/files";
import { parseJson } from "@/lib/json";
import { PageHeader, EmptyState, Alert } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StateBanner } from "@/components/student/state-banner";
import { SubmissionStatus } from "@/components/student/submission-status";
import { studentPage } from "../_lib/server";
import { ProjectForm } from "./project-form";

export const metadata = { title: "Live Project" };

export default async function LiveProjectPage() {
  const { student, state, t } = await studentPage();
  const sub = await prisma.submission.findFirst({ where: { studentId: student.id, kind: "PROJECT" }, orderBy: { updatedAt: "desc" } });
  const photos = parseJson<string[]>(sub?.photoFileIds, []);
  const canSubmit = state === "ACTIVE" && sub?.status !== "APPROVED";

  return (
    <>
      <PageHeader title={t("project.title")} description={t("project.subtitle")} />
      <StateBanner state={state} student={student} context="submissions" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader icon={<FolderKanban className="size-5" />} title={sub?.title ?? t("project.current")} description={sub ? undefined : t("project.noneYet")} />
            <CardBody className="space-y-4">
              {sub ? (
                <>
                  {sub.description && <p className="text-sm whitespace-pre-line text-slate-700">{sub.description}</p>}
                  <SubmissionStatus submission={sub} />
                  {sub.status === "APPROVED" && (
                    <Alert tone="success" icon={<Lock />}>
                      {t("sub.approvedLocked")}
                    </Alert>
                  )}
                </>
              ) : (
                <EmptyState icon={<FolderKanban />} title={t("project.emptyTitle")} description={t("project.emptyDesc")} className="py-8" />
              )}
            </CardBody>
          </Card>
          {photos.length > 0 && (
            <Card>
              <CardHeader icon={<ImageIcon className="size-5" />} title={t("project.photos")} description={t("project.photosCount", { n: photos.length })} />
              <CardBody>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((id, i) => (
                    <li key={id}>
                      <a href={fileUrl(id)!} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50 hover:border-brand-300">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fileUrl(id)!} alt={t("project.photoAlt", { n: i + 1 })} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                      </a>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
        <div className="lg:col-span-2">
          {canSubmit ? (
            <Card>
              <CardHeader title={sub ? t("project.resubmitTitle") : t("project.submitTitle")} description={sub?.status === "RESUBMIT" ? t("sub.resubmitRequested") : t("project.formDesc")} />
              <ProjectForm initialTitle={sub?.title ?? ""} initialDescription={sub?.description ?? ""} hasFile={Boolean(sub?.fileId)} hasPhotos={photos.length > 0} resubmit={Boolean(sub)} />
            </Card>
          ) : (
            state !== "ACTIVE" && !sub && <Alert tone="info">{t("sub.inactiveNote")}</Alert>
          )}
        </div>
      </div>
    </>
  );
}
