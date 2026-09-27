import { requirePageRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { CollegeForm } from "../college-form";

export const metadata = { title: "Add college" };

export default async function NewCollegePage() {
  await requirePageRole("ADMIN");
  return (
    <>
      <PageHeader
        back={{ href: "/admin/colleges", label: "Colleges" }}
        title="Add college"
        description="Create a partner college, its revenue share and the college-admin login. You can set domain fees next."
      />
      <CollegeForm mode="create" />
    </>
  );
}
