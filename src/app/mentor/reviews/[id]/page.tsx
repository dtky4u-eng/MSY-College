import { notFound } from "next/navigation";
import { Download, ExternalLink, FileText, History, ImageIcon, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { parseJson } from "@/lib/json";
import { SUBMISSION_STATUS_LABEL, type SubmissionStatus } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { PageHeader, DetailList, Alert } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ReviewForm } from "./review-form";

export const metadata = { title: "Review Submission" };

const KIND_LABEL: Record<string, string> = { ASSIGNMENT: "Assignment", PROJECT: "Live project", REPORT: "Internship report" };

interface HistoryEntry {
  version?: number;
  fileId?: string | null;
  status?: string;
  feedback?: string | null;
  marks?: number | null;
  submittedAt?: string;
  reviewedAt?: string | null;
}

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { mentor } = await requireMentor();
  const s = await prisma.submission.findFirst({
    where: { id, student: { mentorId: mentor.id } },
    include: { student: { select: { id: true, name: true, registrationNumber: true, college: { select: { name: true } } } }, assignment: true },
  });
  if (!s) notFound();
  const photos = parseJson<string[]>(s.photoFileIds, []);
  const history = parseJson<HistoryEntry[]>(s.history, []);
  const reviewer = s.reviewedById ? await prisma.user.findUnique({ where: { id: s.reviewedById }, select: { role: true, mentor: { select: { name: true } } } }) : null;
  const file = fileUrl(s.fileId);
  const brief = fileUrl(s.assignment?.briefFileId);

  return (
    <>
      <PageHeader title={s.assignment?.title ?? s.title ?? KIND_LABEL[s.kind]!} description={`${KIND_LABEL[s.kind]} · ${s.student.name} (${s.student.registrationNumber})`} back={{ href: "/mentor/reviews", label: "Review queue" }} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Submission" icon={<FileText className="size-5" />} actions={<StatusBadge status={s.status} label={SUBMISSION_STATUS_LABEL[s.status as SubmissionStatus]} />} />
            <CardBody className="space-y-5">
              <DetailList
                items={[
                  ["Student", s.student.name],
                  ["College", s.student.college.name],
                  ["Submitted", formatDateTime(s.submittedAt)],
                  ["Version", s.version],
                  ...(s.assignment
                    ? ([
                        ["Due date", formatDate(s.assignment.dueDate)],
                        ["Maximum marks", s.assignment.maxMarks],
                      ] as [string, React.ReactNode][])
                    : []),
                ]}
              />
              {s.description && (
                <div>
                  <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Description</p>
                  <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{s.description}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {file ? (
                  <>
                    <ButtonLink external href={file} target="_blank" rel="noopener" icon={<ExternalLink className="size-4" />}>Open file</ButtonLink>
                    <ButtonLink external href={fileUrl(s.fileId, true)!} variant="outline" icon={<Download className="size-4" />}>Download</ButtonLink>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No file attached.</p>
                )}
                {brief && <ButtonLink external href={brief} target="_blank" rel="noopener" variant="ghost" icon={<FileText className="size-4" />}>Assignment brief</ButtonLink>}
              </div>
            </CardBody>
          </Card>

          {s.kind === "PROJECT" && (
            <Card>
              <CardHeader title="Project photos" icon={<ImageIcon className="size-5" />} description={`${photos.length} photo${photos.length === 1 ? "" : "s"}`} />
              <CardBody>
                {photos.length === 0 ? (
                  <p className="text-sm text-slate-500">No photos were uploaded.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photos.map((p, i) => (
                      <a key={p} href={fileUrl(p)!} target="_blank" rel="noopener" className="group block overflow-hidden rounded-xl border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fileUrl(p)!} alt={`Project photo ${i + 1}`} className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" />
                      </a>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {history.length > 0 && (
            <Card>
              <CardHeader title="Previous versions" icon={<History className="size-5" />} />
              <ul className="divide-y divide-slate-100">
                {history.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">Version {h.version ?? i + 1}{h.submittedAt && <span className="font-normal text-slate-500"> · {formatDate(h.submittedAt)}</span>}</p>
                      {h.feedback && <p className="mt-0.5 text-slate-600">Feedback: {h.feedback}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {h.status && <StatusBadge status={h.status} />}
                      {h.fileId && <a href={fileUrl(h.fileId)!} target="_blank" rel="noopener" className="text-xs font-medium text-brand-600 hover:text-brand-700">Open</a>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card className="lg:sticky lg:top-20">
            <CardHeader title="Review" description={s.reviewedAt ? `Last reviewed ${formatDateTime(s.reviewedAt)}${reviewer ? ` by ${reviewer.mentor?.name ?? (reviewer.role === "ADMIN" ? "MSY College Admin" : "—")}` : ""}` : "Not reviewed yet"} />
            <CardBody>
              {s.status === "APPROVED" ? (
                <div className="space-y-4">
                  <Alert tone="success" icon={<Lock />} title="Approved and locked">
                    Approved submissions cannot be changed.
                  </Alert>
                  <DetailList cols={1} items={[["Feedback", s.feedback ?? "—"], ...(s.assignment ? ([["Marks", `${s.marks ?? "—"} / ${s.assignment.maxMarks}`]] as [string, React.ReactNode][]) : [])]} />
                </div>
              ) : (
                <ReviewForm id={s.id} maxMarks={s.assignment?.maxMarks ?? null} initialFeedback={s.feedback ?? ""} initialMarks={s.marks} status={s.status} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
