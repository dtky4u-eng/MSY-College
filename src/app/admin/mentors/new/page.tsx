import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { PageHeader, Alert } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { MentorForm } from "../mentor-form";

export const metadata = { title: "Add mentor" };

export default async function NewMentorPage() {
  await requirePageRole("ADMIN");
  const [domains, colleges] = await Promise.all([
    prisma.domain.findMany({ select: { id: true, name: true, code: true, active: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.college.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/admin/mentors", label: "Mentors" }} title="Add mentor" description="Create a domain mentor and their login. You can assign students right after." />
      {domains.length === 0 ? (
        <Alert tone="warning" title="No domains yet" action={<ButtonLink href="/admin/learning" size="sm" variant="outline">Open Learning Setup</ButtonLink>}>
          Mentors are tied to a domain. Create at least one domain first.
        </Alert>
      ) : (
        <MentorForm mode="create" domains={domains} colleges={colleges} />
      )}
    </>
  );
}
