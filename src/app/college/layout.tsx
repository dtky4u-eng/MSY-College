import { requireCollege } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { PortalShell } from "@/components/portal/shell";

export const dynamic = "force-dynamic";

export default async function CollegeLayout({ children }: { children: React.ReactNode }) {
  const { college } = await requireCollege();
  return (
    <PortalShell role="COLLEGE" user={{ name: college.name, subtitle: `College code ${college.code}`, photoUrl: fileUrl(college.logoFileId) }}>
      {children}
    </PortalShell>
  );
}
