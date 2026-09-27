import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, parseBody, route, zEmail, zMobile10 } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { istDate, toISTDateString } from "@/lib/format";
import { diffFields, emptyToNull, findStudentOr404, ymdOrNull, zOptText, zRealYmd } from "../_helpers";

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Enter the student's full name").max(100, "Name must be 100 characters or fewer"),
  fatherName: zOptText(100),
  rollNumber: zOptText(40),
  gender: z.preprocess(emptyToNull, z.enum(["MALE", "FEMALE", "OTHER"], "Select a valid gender").nullable().optional()).transform((v) => v ?? null),
  dob: z
    .preprocess(emptyToNull, zRealYmd.nullable().optional())
    .transform((v) => v ?? null)
    .refine((v) => !v || (v >= "1950-01-01" && v <= toISTDateString()), "Date of birth must be a past date"),
  programme: zOptText(60),
  majorSubject: zOptText(100),
  session: zOptText(20),
  semester: zOptText(20),
  mobile: z.preprocess(emptyToNull, zMobile10.nullable().optional()).transform((v) => v ?? null),
  email: z.preprocess(emptyToNull, zEmail.max(120).nullable().optional()).transform((v) => v ?? null),
});

/** Student record (admin). */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireApiRole("ADMIN");
  const { id } = await params;
  const s = await prisma.student.findUnique({
    where: { id },
    include: { college: { select: { id: true, name: true, code: true } }, domain: { select: { id: true, name: true, code: true } }, mentor: { select: { id: true, name: true, employeeId: true } } },
  });
  if (!s) throw notFound("Student not found");
  return s;
});

/** Edit personal and academic details (FR-ADM-6). Audited with a before/after diff (NFR-5). */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const auth = await requireApiRole("ADMIN");
  const { id } = await params;
  const body = await parseBody(req, detailsSchema);
  const s = await findStudentOr404(id);

  const before = {
    name: s.name,
    fatherName: s.fatherName,
    rollNumber: s.rollNumber,
    gender: s.gender,
    dob: ymdOrNull(s.dob),
    programme: s.programme,
    majorSubject: s.majorSubject,
    session: s.session,
    semester: s.semester,
    mobile: s.mobile,
    email: s.email,
  };
  const changes = diffFields(before, body);
  if (Object.keys(changes).length === 0) return { changed: [] };

  await prisma.student.update({
    where: { id },
    data: { ...body, dob: body.dob ? istDate(body.dob) : null },
  });
  await audit(auth.user.id, "STUDENT_UPDATE", "Student", id, { section: "DETAILS", changes });
  return { changed: Object.keys(changes) };
});
