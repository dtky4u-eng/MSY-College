import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, conflict, parseBody, route } from "@/lib/http";
import { requireApiRole, revokeAllSessions } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { STUDENT_STATUS } from "@/lib/constants";
import { findStudentOr404 } from "../../_helpers";

const schema = z
  .object({
    status: z.enum(STUDENT_STATUS, "Select a valid status"),
    reason: z.string().trim().max(500, "Reason must be 500 characters or fewer").optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.status === "BLOCKED" && v.reason.length < 5) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Enter the reason for blocking (at least 5 characters)" });
    }
  });

const LABEL: Record<string, string> = { PENDING: "Pending", ACTIVE: "Active", COMPLETED: "Completed", BLOCKED: "Blocked" };

/**
 * Change a student's lifecycle status (FR-ADM-6). Blocking needs a reason, signs the student out everywhere
 * and is shown to the student; unblocking clears the reason. Audited as STUDENT_STATUS (NFR-5).
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const auth = await requireApiRole("ADMIN");
  const { id } = await params;
  const { status, reason } = await parseBody(req, schema);
  const s = await findStudentOr404(id);

  const reasonChangedOnly = status === "BLOCKED" && s.status === "BLOCKED" && reason !== (s.blockedReason ?? "");
  if (s.status === status && !reasonChangedOnly) throw conflict(`This student is already ${LABEL[status]?.toLowerCase()}.`);
  if (status === "ACTIVE" && s.paymentStatus !== "PAID") {
    throw new ApiError(422, "Only students who have paid the internship fee can be made active.", { status: "Only paid students can be made active" });
  }

  await prisma.student.update({
    where: { id },
    data: {
      status,
      blockedReason: status === "BLOCKED" ? reason : null,
      completedAt: status === "COMPLETED" ? (s.completedAt ?? new Date()) : null,
    },
  });

  let sessionsRevoked = false;
  if (status === "BLOCKED" && s.userId) {
    await revokeAllSessions(s.userId);
    sessionsRevoked = true;
  }

  await audit(auth.user.id, "STUDENT_STATUS", "Student", id, {
    from: s.status,
    to: status,
    reason: reason || null,
    ...(reasonChangedOnly ? { previousReason: s.blockedReason } : {}),
    sessionsRevoked,
  });

  if (s.userId && !reasonChangedOnly) {
    const body =
      status === "BLOCKED"
        ? `Your internship access has been blocked. Reason: ${reason}. Contact the MSY College helpdesk if you believe this is a mistake.`
        : s.status === "BLOCKED"
          ? "Your internship access has been restored."
          : `Your internship status is now ${LABEL[status]}.`;
    await notify([s.userId], { title: "Internship status updated", body, kind: "SYSTEM", link: "/student" });
  }
  return { status, sessionsRevoked };
});
