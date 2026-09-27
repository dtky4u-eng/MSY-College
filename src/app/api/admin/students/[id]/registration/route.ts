import { z } from "zod";
import { prisma } from "@/lib/db";
import { conflict, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { findStudentOr404 } from "../../_helpers";

const schema = z.object({
  action: z.enum(["UNLOCK", "LOCK"], "Choose unlock or lock"),
  reason: z.string().trim().min(10, "Enter a reason of at least 10 characters").max(500, "Reason must be 500 characters or fewer"),
});

/**
 * Unlock a confirmed registration so the student can correct it, or lock it again.
 * Unpaid students restart from the details step; paid students keep their step. Audited (NFR-5).
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const auth = await requireApiRole("ADMIN");
  const { id } = await params;
  const { action, reason } = await parseBody(req, schema);
  const s = await findStudentOr404(id);

  if (action === "UNLOCK") {
    if (!s.registrationLocked) throw conflict("This registration is already unlocked.");
    const nextStep = s.paymentStatus === "PAID" ? s.nextStep : Math.min(s.nextStep, 2);
    await prisma.student.update({ where: { id }, data: { registrationLocked: false, lockedAt: null, nextStep } });
    await audit(auth.user.id, "STUDENT_UPDATE", "Student", id, {
      action: "UNLOCK_REGISTRATION",
      reason,
      changes: { registrationLocked: { from: true, to: false }, nextStep: { from: s.nextStep, to: nextStep } },
    });
    if (s.userId) {
      await notify([s.userId], {
        title: "Your registration is open for corrections",
        body: s.paymentStatus === "PAID" ? "You can now correct your registration details." : "Review and correct your details, then confirm your registration again.",
        kind: "INFO",
        link: s.paymentStatus === "PAID" ? "/student" : "/register",
      });
    }
    return { registrationLocked: false, nextStep };
  }

  if (s.registrationLocked) throw conflict("This registration is already locked.");
  if (s.paymentStatus !== "PAID" && s.nextStep < 6) throw conflict("Only a registration that the student has confirmed or paid for can be locked.");
  await prisma.student.update({ where: { id }, data: { registrationLocked: true, lockedAt: new Date() } });
  await audit(auth.user.id, "STUDENT_UPDATE", "Student", id, {
    action: "LOCK_REGISTRATION",
    reason,
    changes: { registrationLocked: { from: false, to: true } },
  });
  return { registrationLocked: true, nextStep: s.nextStep };
});
