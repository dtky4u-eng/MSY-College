import { CalendarClock, Download, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { studentPage } from "../_lib/server";

export const metadata = { title: "Routine" };

export default async function RoutinePage() {
  const { student, t } = await studentPage();
  const routines = await prisma.routine.findMany({
    where: { active: true, publishAt: { lte: new Date() }, OR: [{ domainId: null }, ...(student.domainId ? [{ domainId: student.domainId }] : [])] },
    orderBy: { publishAt: "desc" },
    include: { domain: { select: { name: true } } },
  });
  const files = routines.length ? await prisma.fileObject.findMany({ where: { id: { in: routines.map((r) => r.fileId) } }, select: { id: true, mime: true, originalName: true } }) : [];
  const fMap = new Map(files.map((f) => [f.id, f]));

  return (
    <>
      <PageHeader title={t("routine.title")} description={t("routine.subtitle")} />
      {routines.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarClock />} title={t("routine.emptyTitle")} description={t("routine.emptyDesc")} />
        </Card>
      ) : (
        <div className="space-y-6">
          {routines.map((r, i) => {
            const f = fMap.get(r.fileId);
            const url = fileUrl(r.fileId)!;
            const isPdf = f?.mime === "application/pdf";
            const isImage = f?.mime.startsWith("image/");
            return (
              <Card key={r.id}>
                <CardHeader
                  icon={<CalendarClock className="size-5" />}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {r.title}
                      {i === 0 && <Badge tone="green">{t("routine.latest")}</Badge>}
                      <Badge tone="gray">{r.domain?.name ?? t("routine.allDomains")}</Badge>
                    </span>
                  }
                  description={t("routine.published", { date: formatDateTime(r.publishAt) })}
                  actions={
                    <>
                      <ButtonLink href={url} external target="_blank" rel="noopener" variant="outline" size="sm" icon={<ExternalLink className="size-4" />}>
                        {t("action.view")}
                      </ButtonLink>
                      <ButtonLink href={fileUrl(r.fileId, true)!} external size="sm" icon={<Download className="size-4" />}>
                        {t("action.download")}
                      </ButtonLink>
                    </>
                  }
                />
                <CardBody className="space-y-4">
                  {r.description && <p className="text-sm whitespace-pre-line text-slate-600">{r.description}</p>}
                  {!f ? (
                    <p className="text-sm text-rose-600">{t("routine.fileMissing")}</p>
                  ) : isPdf ? (
                    <iframe src={url} title={r.title} className="h-[70vh] min-h-[420px] w-full rounded-xl border border-slate-200 bg-slate-50" loading={i === 0 ? "eager" : "lazy"} />
                  ) : isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={r.title} className="mx-auto max-h-[80vh] w-auto rounded-xl border border-slate-200" loading="lazy" />
                  ) : (
                    <p className="text-sm text-slate-500">{f.originalName}</p>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
