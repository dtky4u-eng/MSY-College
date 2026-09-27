import { prisma } from "@/lib/db";
import { ApiError, formFile, route } from "@/lib/http";
import { KIND_SETS } from "@/lib/files";
import { requireActiveStudent } from "@/app/student/_lib/server";
import { readMultipart, submitWork } from "@/app/student/_lib/submissions";
import { isLate } from "@/components/student/utils";

/** FR-STU-7 / WF-3: upload or re-upload an assignment (PDF/DOC/DOCX/PPT/PPTX/ZIP ≤ 10 MB). */
export const POST = route<{ assignmentId: string }>(async (req, { params }) => {
  const { assignmentId } = await params;
  const { student, t } = await requireActiveStudent();
  const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, domainId: student.domainId ?? "__none__" } });
  if (!assignment) throw new ApiError(404, t("asg.err.notFound"));
  const form = await readMultipart(req, t);
  const result = await submitWork({
    student,
    t,
    kind: "ASSIGNMENT",
    assignmentId: assignment.id,
    title: assignment.title,
    file: formFile(form, "file"),
    requireFile: true,
    fileKinds: KIND_SETS.submission,
    notifyTitle: `Assignment submitted: ${assignment.title}`,
  });
  return { ...result, late: isLate(new Date(), assignment.dueDate) };
});
