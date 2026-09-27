import { z } from "zod";
import { formFields, formFile, route, validate } from "@/lib/http";
import { KIND_SETS } from "@/lib/files";
import { requireActiveStudent } from "@/app/student/_lib/server";
import { formPhotos, readMultipart, submitWork } from "@/app/student/_lib/submissions";

/** FR-STU-9: live project — title, description, project report (≤ 10 MB) and up to 5 photos (≤ 2 MB each). */
export const POST = route(async (req) => {
  const { student, t } = await requireActiveStudent();
  const form = await readMultipart(req, t);
  const schema = z.object({
    title: z.string().trim().min(5, t("project.err.titleMin")).max(150, t("project.err.titleMax")),
    description: z.string().trim().min(20, t("project.err.descMin")).max(3000, t("project.err.descMax")),
  });
  const body = validate(schema, formFields(form));
  return submitWork({
    student,
    t,
    kind: "PROJECT",
    title: body.title,
    description: body.description,
    file: formFile(form, "file"),
    photos: formPhotos(form),
    requireFile: false, // a resubmission may keep the previously uploaded report
    fileKinds: KIND_SETS.submission,
    notifyTitle: `Live project submitted: ${body.title}`,
  });
});
