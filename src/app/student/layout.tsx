import { requireStudent } from "@/lib/auth";
import { getLang } from "@/lib/i18n/server";
import { fileUrl } from "@/lib/files";
import { PortalShell } from "@/components/portal/shell";
import { I18nProvider, LanguageToggle } from "@/components/i18n";
import { LiveClassPopup } from "@/components/student/live-class-popup";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { student } = await requireStudent();
  const lang = await getLang();
  return (
    <I18nProvider lang={lang}>
      <PortalShell
        role="STUDENT"
        user={{ name: student.name, subtitle: student.portalRegNo ?? student.registrationNumber, photoUrl: fileUrl(student.photoFileId) }}
        topbarExtra={<LanguageToggle compact />}
      >
        {children}
      </PortalShell>
      <LiveClassPopup />
    </I18nProvider>
  );
}
