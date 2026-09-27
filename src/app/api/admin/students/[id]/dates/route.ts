import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { formatDate, istDate } from "@/lib/format";
import { findStudentOr404, ymdOrNull, zRealYmd } from "../../_helpers";

const schema = z
  .object({ startDate: zRealYmd, endDate: zRealYmd })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "End date must be on or after the start date" })
  .refine((v) => (istDate(v.endDate).getTime() - istDate(v.startDate).getTime()) / 86400000 <= 366, {
    path: ["endDate"],
    message: "An internship cannot be longer than one year",
  });

/**
 * Set or change the internship start/end dates of a paid student (FR-ADM-6).
 * The first start date moves a pending student to ACTIVE (INTERNSHIP_START); later changes are STUDENT_UPDATE.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const auth = await requireApiRole("ADMIN");
  const { id } = await params;
  const { startDate, endDate } = await parseBody(req, schema);
  const s = await findStudentOr404(id);
  if (s.paymentStatus !== "PAID") {
    throw new ApiError(422, "Internship dates can be set only after the student has paid the internship fee.", {
      startDate: "The student has not paid the internship fee yet",
    });
  }

  const from = { startDate: ymdOrNull(s.internshipStart), endDate: ymdOrNull(s.internshipEnd) };
  if (from.startDate === startDate && from.endDate === endDate) return { changed: false };

  const activate = s.status === "PENDING";
  await prisma.student.update({
    where: { id },
    data: { internshipStart: istDate(startDate), internshipEnd: istDate(endDate), ...(activate ? { status: "ACTIVE" } : {}) },
  });

  const first = !s.internshipStart;
  await audit(auth.user.id, first ? "INTERNSHIP_START" : "STUDENT_UPDATE", "Student", id, {
    section: "DATES",
    changes: {
      internshipStart: { from: from.startDate, to: startDate },
      internshipEnd: { from: from.endDate, to: endDate },
      ...(activate ? { status: { from: s.status, to: "ACTIVE" } } : {}),
    },
  });

  if (s.userId) {
    await notify([s.userId], {
      title: first ? "Your internship start date is set" : "Your internship dates have changed",
      body: `Your internship runs from ${formatDate(startDate)} to ${formatDate(endDate)}.`,
      kind: "INFO",
      link: "/student",
    });
  }
  return { changed: true, activated: activate };
});
