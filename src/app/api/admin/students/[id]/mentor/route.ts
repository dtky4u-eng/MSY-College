import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { emptyToNull, findStudentOr404 } from "../../_helpers";

const schema = z.object({
  domainId: z.preprocess(emptyToNull, z.string().max(64).nullable()).default(null),
  mentorId: z.preprocess(emptyToNull, z.string().max(64).nullable()).default(null),
});

const fieldError = (field: string, message: string) => new ApiError(422, message, { [field]: message });

/**
 * Change a student's internship domain and/or mentor (FR-ADM-6).
 * The mentor must be active and belong to the (new) domain; a domain change drops an incompatible mentor.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const auth = await requireApiRole("ADMIN");
  const { id } = await params;
  const { domainId, mentorId } = await parseBody(req, schema);
  const s = await findStudentOr404(id);

  let domain: { id: string; name: string; code: string } | null = null;
  if (domainId) {
    const d = await prisma.domain.findUnique({ where: { id: domainId }, select: { id: true, name: true, code: true, active: true } });
    if (!d) throw fieldError("domainId", "The selected domain no longer exists");
    if (!d.active && d.id !== s.domainId) throw fieldError("domainId", "This domain is inactive and cannot be assigned");
    domain = d;
  } else if (s.paymentStatus === "PAID") {
    throw fieldError("domainId", "A paid student must keep an internship domain");
  }

  let mentor: { id: string; name: string; userId: string; domainId: string } | null = null;
  if (mentorId) {
    if (!domain) throw fieldError("mentorId", "Choose a domain before assigning a mentor");
    const m = await prisma.mentor.findUnique({ where: { id: mentorId }, select: { id: true, name: true, userId: true, domainId: true, active: true } });
    if (!m) throw fieldError("mentorId", "The selected mentor no longer exists");
    if (m.domainId !== domain.id) throw fieldError("mentorId", "The mentor must belong to the student's domain");
    if (!m.active && m.id !== s.mentorId) throw fieldError("mentorId", "This mentor is inactive and cannot be assigned");
    mentor = m;
  }

  const domainChanged = (s.domainId ?? null) !== (domain?.id ?? null);
  const mentorChanged = (s.mentorId ?? null) !== (mentor?.id ?? null);
  if (!domainChanged && !mentorChanged) return { changed: false };

  await prisma.student.update({
    where: { id },
    data: {
      domainId: domain?.id ?? null,
      mentorId: mentor?.id ?? null,
      ...(mentorChanged ? { mentorAssignedAt: mentor ? new Date() : null } : {}),
    },
  });

  if (domainChanged) {
    const prev = s.domainId ? await prisma.domain.findUnique({ where: { id: s.domainId }, select: { code: true } }) : null;
    await audit(auth.user.id, "STUDENT_UPDATE", "Student", id, {
      section: "DOMAIN",
      changes: { domainId: { from: s.domainId, to: domain?.id ?? null } },
      fromDomain: prev?.code ?? null,
      toDomain: domain?.code ?? null,
      paymentStatus: s.paymentStatus,
      feeAmount: s.feeAmount,
    });
  }
  if (mentorChanged) {
    await audit(auth.user.id, "MENTOR_ASSIGN", "Student", id, {
      from: s.mentorId,
      to: mentor?.id ?? null,
      mentorName: mentor?.name ?? null,
      reason: domainChanged && !mentor ? "Cleared because the domain changed" : undefined,
    });
  }

  if (s.userId && mentor && mentorChanged) {
    await notify([s.userId], {
      title: "Your mentor has been assigned",
      body: `${mentor.name} is now your internship mentor${domain ? ` for ${domain.name}` : ""}.`,
      kind: "INFO",
      link: "/student",
    });
  }
  if (mentor && mentorChanged) {
    await notify([mentor.userId], { title: "New student assigned", body: `${s.name} (${s.portalRegNo ?? s.registrationNumber}) has been assigned to you.`, kind: "INFO", link: "/mentor" });
  }
  if (s.userId && domainChanged && domain) {
    await notify([s.userId], { title: "Internship domain updated", body: `Your internship domain is now ${domain.name}.`, kind: "INFO", link: "/student" });
  }

  return { changed: true, domainChanged, mentorChanged, mentorCleared: mentorChanged && !mentor };
});
