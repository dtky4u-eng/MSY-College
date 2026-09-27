// WF-3 submission flow shared by assignments, live project and internship report.
import "server-only";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { KIND_SETS, saveUpload, deleteStoredFile } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { notify } from "@/lib/notify";
import { parseJson } from "@/lib/json";
import type { TFn } from "@/lib/i18n";
import { mentorUserId, parseHistory, type HistoryItem, type StudentRecord } from "./server";

export const MAX_PROJECT_PHOTOS = 5;

type Kind = "ASSIGNMENT" | "PROJECT" | "REPORT";

export async function readMultipart(req: Request, t: TFn): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw new ApiError(400, t("upload.err.form"));
  }
}

export function formPhotos(form: FormData): File[] {
  return form.getAll("photos").filter((v): v is File => typeof v !== "string" && v.size > 0);
}

/**
 * Create or resubmit a submission. Approved submissions are locked (NFR-4). A resubmission keeps the previous
 * version in `history`, bumps `version` and returns to Pending Review. Files are saved before the DB write and
 * removed again if the write fails.
 */
export async function submitWork(opts: {
  student: StudentRecord;
  t: TFn;
  kind: Kind;
  assignmentId?: string | null;
  title?: string | null;
  description?: string | null;
  file: File | null;
  photos?: File[];
  requireFile: boolean;
  fileKinds: typeof KIND_SETS.submission;
  notifyTitle: string;
}) {
  const { student, t, kind } = opts;
  const photos = opts.photos ?? [];
  if (photos.length > MAX_PROJECT_PHOTOS) throw new ApiError(422, t("project.err.photoCount", { n: MAX_PROJECT_PHOTOS }), { photos: t("project.err.photoCount", { n: MAX_PROJECT_PHOTOS }) });

  const existing = await prisma.submission.findFirst({
    where: { studentId: student.id, kind, ...(opts.assignmentId ? { assignmentId: opts.assignmentId } : {}) },
    orderBy: { updatedAt: "desc" },
  });
  if (existing?.status === "APPROVED") throw new ApiError(409, t("sub.err.locked"));
  if (!opts.file && (opts.requireFile || !existing?.fileId)) throw new ApiError(422, t("sub.err.fileRequired"), { file: t("sub.err.fileRequired") });

  const saved: string[] = [];
  try {
    let fileId = existing?.fileId ?? null;
    if (opts.file) {
      const f = await saveUpload(opts.file, {
        purpose: "SUBMISSION",
        allowed: opts.fileKinds,
        maxBytes: LIMITS.submissionBytes,
        ownerUserId: student.userId,
        studentId: student.id,
        label: t("sub.fileLabel"),
      });
      saved.push(f.id);
      fileId = f.id;
    }
    let photoFileIds = parseJson<string[]>(existing?.photoFileIds, []);
    if (photos.length) {
      const ids: string[] = [];
      for (const p of photos) {
        const f = await saveUpload(p, {
          purpose: "PROJECT_PHOTO",
          allowed: KIND_SETS.image,
          maxBytes: LIMITS.imageBytes,
          ownerUserId: student.userId,
          studentId: student.id,
          label: t("project.photoLabel"),
        });
        saved.push(f.id);
        ids.push(f.id);
      }
      photoFileIds = ids;
    }

    let row;
    if (existing) {
      const history: HistoryItem[] = [
        ...parseHistory(existing.history),
        {
          fileId: existing.fileId,
          submittedAt: existing.submittedAt.toISOString(),
          status: existing.status,
          feedback: existing.feedback,
          marks: existing.marks,
          title: existing.title,
          photoFileIds: parseJson<string[]>(existing.photoFileIds, []),
        },
      ];
      row = await prisma.submission.update({
        where: { id: existing.id },
        data: {
          title: opts.title ?? existing.title,
          description: opts.description ?? existing.description,
          fileId,
          photoFileIds: JSON.stringify(photoFileIds),
          status: "PENDING",
          marks: null,
          feedback: null,
          reviewedById: null,
          reviewedAt: null,
          version: existing.version + 1,
          history: JSON.stringify(history),
          submittedAt: new Date(),
          generated: false,
        },
      });
    } else {
      row = await prisma.submission.create({
        data: {
          studentId: student.id,
          kind,
          assignmentId: opts.assignmentId ?? null,
          title: opts.title ?? null,
          description: opts.description ?? null,
          fileId,
          photoFileIds: JSON.stringify(photoFileIds),
        },
      });
    }

    await notify([await mentorUserId(student.mentorId)], {
      title: opts.notifyTitle,
      body: `${student.name} (${student.portalRegNo ?? student.registrationNumber}) ${existing ? `resubmitted (version ${row.version})` : "submitted"} work for review.`,
      kind: "REVIEW",
      link: "/mentor/reviews",
    });
    return { id: row.id, version: row.version, status: row.status, resubmitted: Boolean(existing) };
  } catch (e) {
    for (const id of saved) await deleteStoredFile(id).catch(() => undefined);
    throw e;
  }
}
