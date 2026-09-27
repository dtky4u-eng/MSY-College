import "server-only";
import { z } from "zod";
import { ApiError, formFields, formFile, validate } from "@/lib/http";
import { KIND_SETS, type FileKind } from "@/lib/files";
import { RESOURCE_TYPES, type ResourceType } from "@/lib/constants";

const bool = z
  .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0"), z.literal("on"), z.literal("")])
  .optional()
  .transform((v) => v === "true" || v === "1" || v === "on");

export const resourceSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(160),
  type: z.enum(RESOURCE_TYPES, { message: "Choose a resource type" }),
  sortOrder: z.coerce.number({ message: "Enter a sort order" }).int("Sort order must be a whole number").min(1, "Sort order must be at least 1").max(999),
  primary: bool,
  downloadable: bool,
  url: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), "Enter a valid URL starting with http:// or https://"),
  content: z
    .string()
    .max(50000, "Notes are too long")
    .optional()
    .transform((v) => (v && v.trim() ? v : null)),
  removeFile: bool,
});

/** Allowed upload kinds per resource type (all are subsets of KIND_SETS.resource). */
export const TYPE_KINDS: Record<ResourceType, FileKind[]> = {
  VIDEO: ["mp4"],
  PDF: ["pdf"],
  NOTES: [],
  LINK: [],
  CODE: ["zip", "txt"],
  OTHER: KIND_SETS.resource,
};

export async function readResourceForm(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "Send the resource as multipart form data");
  }
  const data = validate(resourceSchema, formFields(form));
  const file = formFile(form, "file");
  if (file && TYPE_KINDS[data.type].length === 0) throw new ApiError(422, "This resource type does not take a file upload", { file: "Remove the file for this type" });
  return { data, file, chapterId: String(form.get("chapterId") ?? "") };
}

/** Ensure the resource has the source its type needs. `hasFile` = new upload or kept existing file. */
export function checkSource(type: ResourceType, v: { url: string | null; content: string | null; hasFile: boolean }) {
  const need = (field: string, msg: string) => {
    throw new ApiError(422, msg, { [field]: msg });
  };
  switch (type) {
    case "VIDEO":
      if (!v.url && !v.hasFile) need("url", "Add a video URL or upload an MP4 file");
      break;
    case "PDF":
      if (!v.hasFile) need("file", "Upload the PDF file");
      break;
    case "NOTES":
      if (!v.content) need("content", "Enter the notes content");
      break;
    case "LINK":
      if (!v.url) need("url", "Enter the link URL");
      break;
    default:
      if (!v.url && !v.hasFile) need("file", "Upload a file or add a URL");
  }
}
