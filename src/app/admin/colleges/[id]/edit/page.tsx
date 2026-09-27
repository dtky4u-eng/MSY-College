import { notFound } from "next/navigation";
import { IndianRupee } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { CollegeForm } from "../../college-form";

export const metadata = { title: "Edit college" };

export default async function EditCollegePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole("ADMIN");
  const { id } = await params;
  const c = await prisma.college.findUnique({
    where: { id },
    include: { adminUser: true, _count: { select: { students: true, settlements: true, mentors: true } } },
  });
  if (!c) notFound();

  const blockers = [
    c._count.students && `${c._count.students} student(s)`,
    c._count.mentors && `${c._count.mentors} mentor(s)`,
    c._count.settlements && `${c._count.settlements} settlement(s)`,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/colleges", label: "Colleges" }}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {c.name} <StatusBadge status={c.status} />
          </span>
        }
        description={
          <>
            Code <span className="font-mono font-semibold text-slate-700">{c.code}</span> · {c.university} · Last updated {formatDateTime(c.updatedAt)}
            {c.adminUser?.lastLoginAt ? ` · Last college login ${formatDateTime(c.adminUser.lastLoginAt)}` : ""}
          </>
        }
        actions={
          <ButtonLink href={`/admin/colleges/${c.id}/domain-fees`} variant="outline" icon={<IndianRupee className="size-4" />}>
            Domain fees
          </ButtonLink>
        }
      />
      <CollegeForm
        mode="edit"
        collegeId={c.id}
        logoUrl={fileUrl(c.logoFileId)}
        hasLogin={Boolean(c.adminUser)}
        deletable={
          blockers.length
            ? { allowed: false, reason: `This college has ${blockers.join(", ")} and cannot be deleted. Set its status to Inactive instead.` }
            : { allowed: true }
        }
        initial={{
          code: c.code,
          name: c.name,
          university: c.university,
          principal: c.principal ?? "",
          coordinator: c.coordinator ?? "",
          email: c.email ?? "",
          mobile: c.mobile ?? "",
          state: c.state ?? "",
          district: c.district ?? "",
          pincode: c.pincode ?? "",
          address: c.address ?? "",
          collegeShare: String(c.collegeShare),
          rknexoraShare: String(c.rknexoraShare),
          status: (["ACTIVE", "PENDING", "INACTIVE"].includes(c.status) ? c.status : "ACTIVE") as "ACTIVE" | "PENDING" | "INACTIVE",
          username: c.adminUser?.username ?? c.code.toLowerCase(),
          loginEmail: c.adminUser?.email ?? c.email ?? "",
        }}
      />
    </>
  );
}
