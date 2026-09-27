import { requireMentor } from "@/lib/auth";
import { PortalShell } from "@/components/portal/shell";

export const dynamic = "force-dynamic";

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const { mentor } = await requireMentor();
  return (
    <PortalShell role="MENTOR" user={{ name: mentor.name, subtitle: `${mentor.domain.name} mentor`, photoUrl: mentor.photoUrl }}>
      {children}
    </PortalShell>
  );
}
