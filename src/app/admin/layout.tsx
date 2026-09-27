import { requirePageRole } from "@/lib/auth";
import { PortalShell } from "@/components/portal/shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requirePageRole("ADMIN");
  return (
    <PortalShell role="ADMIN" user={{ name: auth.user.name || "MSY College Admin", subtitle: auth.user.email ?? "Administrator" }}>
      {children}
    </PortalShell>
  );
}
