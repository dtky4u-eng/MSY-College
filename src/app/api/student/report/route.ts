import { formFile, route } from "@/lib/http";
import type { FileKind } from "@/lib/files";
import { requireActiveStudent } from "@/app/student/_lib/server";
import { readMultipart, submitWork } from "@/app/student/_lib/submissions";

const REPORT_KINDS: FileKind[] = ["pdf", "doc", "docx"];

/** FR-STU-9: upload the final signed internship report (PDF/DOC/DOCX ≤ 10 MB) for mentor review. */
export const POST = route(async (req) => {
  const { student, t } = await requireActiveStudent();
  const form = await readMultipart(req, t);
  return submitWork({
    student,
    t,
    kind: "REPORT",
    title: "Final internship report (signed)",
    file: formFile(form, "file"),
    requireFile: true,
    fileKinds: REPORT_KINDS,
    notifyTitle: "Internship report submitted",
  });
});
