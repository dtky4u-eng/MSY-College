// Public certificate verification (G-3, NFR-10). Returns minimal, non-sensitive details only —
// never mobile, email, date of birth or parent names.
import "server-only";
import { prisma } from "@/lib/db";

export interface CertificateCheck {
  status: "VALID" | "REVOKED" | "NOT_FOUND";
  query: string;
  certificate?: {
    certificateNo: string;
    verifyCode: string;
    issuedAt: string;
    revokedAt: string | null;
    studentName: string;
    registrationNumber: string;
    domain: string | null;
    college: string;
    university: string;
    internshipStart: string | null;
    internshipEnd: string | null;
    hours: number | null;
    grade: string | null;
    result: string | null;
  };
}

export function normaliseCertQuery(raw: string): string {
  let v = raw;
  try {
    v = decodeURIComponent(raw);
  } catch {
    // keep as is
  }
  return v.trim().toUpperCase().replace(/\s+/g, "");
}

/** Mask the middle of a registration number so it can be matched against a document without exposing it fully. */
function mask(v: string) {
  if (v.length <= 4) return v;
  const keep = Math.min(3, Math.floor(v.length / 4));
  return v.slice(0, keep) + "•".repeat(Math.max(3, v.length - keep * 2)) + v.slice(-keep);
}

export async function lookupCertificate(raw: string): Promise<CertificateCheck> {
  const query = normaliseCertQuery(raw);
  if (!query || query.length > 80) return { status: "NOT_FOUND", query };
  const cert = await prisma.certificate.findFirst({
    where: { OR: [{ verifyCode: query }, { certificateNo: query }] },
    include: {
      student: {
        select: {
          name: true,
          registrationNumber: true,
          internshipStart: true,
          internshipEnd: true,
          completedAt: true,
          grade: true,
          resultStatus: true,
          domain: { select: { name: true, durationHours: true } },
          college: { select: { name: true, university: true } },
        },
      },
    },
  });
  if (!cert) return { status: "NOT_FOUND", query };
  const s = cert.student;
  return {
    status: cert.revokedAt ? "REVOKED" : "VALID",
    query,
    certificate: {
      certificateNo: cert.certificateNo,
      verifyCode: cert.verifyCode,
      issuedAt: cert.issuedAt.toISOString(),
      revokedAt: cert.revokedAt?.toISOString() ?? null,
      studentName: s.name,
      registrationNumber: mask(s.registrationNumber),
      domain: s.domain?.name ?? null,
      college: s.college.name,
      university: s.college.university,
      internshipStart: s.internshipStart?.toISOString() ?? null,
      internshipEnd: (s.internshipEnd ?? s.completedAt)?.toISOString() ?? null,
      hours: s.domain?.durationHours ?? null,
      grade: s.grade,
      result: s.resultStatus,
    },
  };
}
