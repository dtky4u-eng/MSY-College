import type { Metadata } from "next";
import { getLang } from "@/lib/i18n/server";
import { buildRegState, getRegSession } from "@/lib/registration";
import { I18nProvider } from "@/components/i18n";
import { RegisterShell } from "@/components/register/shell";
import { RegisterWizard } from "@/components/register/wizard";

export const metadata: Metadata = {
  title: "Student Internship Registration",
  description: "Register for your NEP 2020 / CBCS internship with your University / College Registration Number.",
};

export const dynamic = "force-dynamic";

/** FR-REG: 6-step bilingual registration wizard. Resumes from the registration cookie when present. */
export default async function RegisterPage() {
  const lang = await getLang();
  const session = await getRegSession();
  const state = session ? await buildRegState(session.studentId).catch(() => null) : null;
  return (
    <I18nProvider lang={lang}>
      <RegisterShell>
        <RegisterWizard initial={state} />
      </RegisterShell>
    </I18nProvider>
  );
}
