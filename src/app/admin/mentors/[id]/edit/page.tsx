import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { MentorForm } from "../../mentor-form";

export const metadata = { title: "Edit mentor" };

export default async function EditMentorPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole("ADMIN");
  const { id } = await params;
  const [m, domains, colleges] = await Promise.all([
    prisma.mentor.findUnique({ where: { id }, include: { user: true, domain: true, _count: { select: { students: true, assessments: true } } } }),
    prisma.domain.findMany({ select: { id: true, name: true, code: true, active: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.college.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);
  if (!m) notFound();
  const reason = m._count.students
    ? `This mentor has ${m._count.students} assigned student(s) and cannot be deleted. Remove the students first or mark the mentor inactive.`
    : m._count.assessments
      ? "This mentor has submitted assessments and cannot be deleted. Mark the mentor inactive instead."
      : undefined;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/mentors", label: "Mentors" }}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {m.name} <StatusBadge status={m.active ? "ACTIVE" : "INACTIVE"} />
          </span>
        }
        description={
          <>
            <span className="font-mono">{m.employeeId}</span> · {m.domain.name} · {m._count.students} assigned student(s) · Last login {formatDateTime(m.user.lastLoginAt)}
          </>
        }
        actions={
          <ButtonLink href={`/admin/mentors/${m.id}/assign-students`} variant="outline" icon={<Users className="size-4" />}>
            Assign students
          </ButtonLink>
        }
      />
      <MentorForm
        mode="edit"
        mentorId={m.id}
        domains={domains}
        colleges={colleges}
        assignedCount={m._count.students}
        deletable={reason ? { allowed: false, reason } : { allowed: true }}
        initial={{
          name: m.name,
          employeeId: m.employeeId,
          mobile: m.mobile ?? "",
          email: m.email ?? "",
          domainId: m.domainId,
          collegeId: m.collegeId ?? "",
          photoUrl: m.photoUrl ?? "",
          designation: m.designation ?? "",
          active: m.active,
          username: m.user.username,
        }}
      />
    </>
  );
}
