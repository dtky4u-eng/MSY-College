import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireMentor } from "@/lib/auth";
import { assessmentScore } from "@/lib/student";
import { ASSESSMENT_CRITERIA, RATINGS } from "@/lib/constants";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { assignedStudent } from "@/app/mentor/_lib/scope";

const rating = z.enum(RATINGS.map((r) => r.value) as [string, ...string[]], { message: "Choose a rating" });
const schema = z.object({
  ratings: z.object(Object.fromEntries(ASSESSMENT_CRITERIA.map((c) => [c.key, rating])) as Record<string, typeof rating>),
  remarks: z.string().trim().min(10, "Supervisor remarks must be at least 10 characters").max(2000),
  recommendCertificate: z.boolean(),
});

/** Create or update the mentor assessment of an assigned student (FR-MEN-6, WF-4). Locked once the result is published. */
export const PUT = route<{ studentId: string }>(async (req, { params }) => {
  const { studentId } = await params;
  const { mentor, auth } = await requireMentor("api");
  const body = await parseBody(req, schema);
  const s = await assignedStudent(mentor, studentId);
  if (s.paymentStatus !== "PAID" || !s.internshipStart || (s.status !== "ACTIVE" && s.status !== "COMPLETED")) {
    throw new ApiError(409, "Assessments can be submitted only for students whose internship has started");
  }
  if (s.resultPublishedAt) throw new ApiError(409, "The result has been published — the assessment can no longer be changed");
  const ratings = Object.fromEntries(ASSESSMENT_CRITERIA.map((c) => [c.key, body.ratings[c.key]!]));
  const score = assessmentScore(ratings);
  const existing = await prisma.assessment.findUnique({ where: { studentId: s.id }, select: { id: true } });
  const data = { ratings: JSON.stringify(ratings), remarks: body.remarks, recommendCertificate: body.recommendCertificate, score, mentorId: mentor.id, generated: false };
  const a = await prisma.assessment.upsert({ where: { studentId: s.id }, update: data, create: { ...data, studentId: s.id } });
  if (!existing) await notify([s.userId], { title: "Mentor assessment submitted", body: "Your mentor has submitted your internship assessment.", kind: "INFO", link: "/student" });
  // Assessment changes feed certificate eligibility, so keep an audit trail.
  await audit(auth.user.id, "CONTENT", "Assessment", a.id, { studentId: s.id, score, recommendCertificate: body.recommendCertificate, action: existing ? "update" : "create" });
  return { id: a.id, score };
});
