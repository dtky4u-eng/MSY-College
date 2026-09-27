// Resolves where a resource's content comes from (external URL, uploaded file or inline notes).
import "server-only";
import type { FileObject } from "@prisma/client";
import { ApiError, formFile } from "@/lib/http";
import { saveUpload } from "@/lib/files";
import { LIMITS, RESOURCE_TYPE_LABEL, type ResourceType } from "@/lib/constants";
import { RESOURCE_FILE_KINDS } from "@/components/admin/core/learning/server";

export interface SourceInput {
  type: ResourceType;
  source?: "url" | "file";
  url: string | null;
  content: string | null;
}

export interface ResolvedSource {
  url: string | null;
  fileId: string | null;
  content: string | null;
  /** A file saved during this request (delete it again if the DB write fails). */
  saved: FileObject | null;
}

/**
 * Work out url/fileId/content for a resource. `existingFileId` is kept when the admin chose "file"
 * without uploading a replacement. Throws 422 with field messages.
 */
export async function resolveSource(form: FormData, v: SourceInput, ownerUserId: string, existing: FileObject | null): Promise<ResolvedSource> {
  const file = formFile(form, "file");
  const existingFileId = existing?.id ?? null;
  const kinds = RESOURCE_FILE_KINDS[v.type] ?? [];
  const content = v.type === "NOTES" ? v.content : null;
  let source = v.source;
  if (v.type === "LINK") source = "url";
  else if (!source && v.type !== "NOTES") source = file || existingFileId ? "file" : "url";

  if (source === "url") {
    if (!v.url) throw new ApiError(422, "Enter the resource URL", { url: "Enter the resource URL" });
    return { url: v.url, fileId: null, content, saved: null };
  }
  if (source === "file") {
    if (file) {
      if (!kinds.length) throw new ApiError(422, "This resource type does not accept files", { file: "This resource type does not accept files" });
      const saved = await saveUpload(file, {
        purpose: "RESOURCE",
        allowed: kinds,
        maxBytes: LIMITS.resourceBytes,
        ownerUserId,
        label: `${RESOURCE_TYPE_LABEL[v.type]} file`,
      }).catch((e: unknown) => {
        if (e instanceof ApiError) throw new ApiError(e.status, e.message, { file: e.message });
        throw e;
      });
      return { url: null, fileId: saved.id, content, saved };
    }
    if (existing) {
      const kind = (existing.path.split(".").pop() ?? "").toLowerCase();
      if (!kinds.includes(kind as (typeof kinds)[number])) {
        const msg = `The current file (${existing.originalName}) is not valid for a ${RESOURCE_TYPE_LABEL[v.type]} resource — upload a new file`;
        throw new ApiError(422, msg, { file: msg });
      }
      return { url: null, fileId: existing.id, content, saved: null };
    }
    throw new ApiError(422, "Choose a file to upload", { file: "Choose a file to upload" });
  }
  // NOTES without an attachment
  return { url: null, fileId: null, content, saved: null };
}
