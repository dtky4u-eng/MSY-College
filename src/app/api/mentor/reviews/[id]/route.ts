import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireMentor } from "@/lib/auth";
import { notify } from "@/lib/notify";

const schema = z.object({
  decision: z.enum(["APPROVED", "RESUBMIT"], { message: "Choose approve or request resubmission" }),
  feedback: z
    .string()
    .trim()
    .max(2000, "Feedback is too long")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  marks: z.number().int("Marks must be a whole number").min(0, "Marks cannot be negative").optional().nullable(),
});

const LINK: Record<string, string> = { ASSIGNMENT: "/student/assignments", PROJECT: "/student/live-project", REPORT: "/student/report" };
const LABEL: Record<string, string> = { ASSIGNMENT: "assignment", PROJECT: "live project", REPORT: "internship report" };

/** Review a submission of an assigned student (FR-MEN-5, WF-3). Approved submissions are locked (NFR-4). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { mentor, auth } = await requireMentor("api");
  const body = await parseBody(req, schema);
  const sub = await prisma.submission.findFirst({
    where: { id, student: { mentorId: mentor.id } },
    include: { assignment: { select: { title: true, maxMarks: true } }, student: { select: { userId: true } } },
  });
  if (!sub) throw new ApiError(404, "Submission not found");
  if (sub.status === "APPROVED") throw new ApiError(409, "This submission is approved and locked");
  if (body.decision === "RESUBMIT" && (!body.feedback || body.feedback.length < 5)) {
    throw new ApiError(422, "Feedback is required when requesting a resubmission", { feedback: "Explain what the student should change (at least 5 characters)" });
  }
  let marks: number | null = null;
  if (sub.kind === "ASSIGNMENT" && sub.assignment) {
    if (body.marks !== null && body.marks !== undefined) {
      if (body.marks > sub.assignment.maxMarks) throw new ApiError(422, `Marks cannot exceed ${sub.assignment.maxMarks}`, { marks: `Enter whole marks between 0 and ${sub.assignment.maxMarks}` });
      marks = body.marks;
    } else if (body.decision === "APPROVED") {
      throw new ApiError(422, "Enter marks to approve this assignment", { marks: `Enter whole marks between 0 and ${sub.assignment.maxMarks}` });
    }
  }

  // Guard against a concurrent approval or resubmission by the student.
  const res = await prisma.submission.updateMany({
    where: { id: sub.id, status: { not: "APPROVED" }, version: sub.version },
    data: { status: body.decision, feedback: body.feedback, marks, reviewedById: auth.user.id, reviewedAt: new Date() },
  });
  if (res.count === 0) throw new ApiError(409, "The submission changed while you were reviewing it. Reload and try again.");

  const what = sub.assignment?.title ?? sub.title ?? LABEL[sub.kind];
  await notify([sub.student.userId], {
    kind: "REVIEW",
    title: body.decision === "APPROVED" ? `Your ${LABEL[sub.kind]} was approved` : `Resubmission requested for your ${LABEL[sub.kind]}`,
    body: body.decision === "APPROVED" ? `“${what}” has been approved${marks !== null ? ` with ${marks}/${sub.assignment!.maxMarks} marks` : ""}.` : `Your mentor asked you to revise “${what}”: ${body.feedback}`,
    link: LINK[sub.kind] ?? "/student",
  });
  return { status: body.decision };
});
