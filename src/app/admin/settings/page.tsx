import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { getEligibilityRules, getInternshipSettings, getSetting, type PaymentSettings } from "@/lib/settings";
import { gatewayStatus, selectGateway } from "@/lib/payments";
import { PageHeader } from "@/components/ui/page";
import { LinkTabs } from "@/components/ui/tabs";
import { ChangePasswordForm, EligibilityForm, InternshipForm, MasterOptionsEditor, PaymentForm } from "./settings-forms";

export const metadata = { title: "Settings" };

const TABS = [
  { key: "certificates", label: "Certificate eligibility" },
  { key: "internship", label: "Internship defaults" },
  { key: "payments", label: "Payment gateway" },
  { key: "master", label: "Master data" },
  { key: "account", label: "My account" },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePageRole("ADMIN");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "certificates";

  return (
    <>
      <PageHeader title="Settings" description="Programme rules, defaults, payment configuration and master data." />
      <LinkTabs items={TABS} className="mb-6" />
      {tab === "certificates" && <EligibilityForm initial={await getEligibilityRules()} />}
      {tab === "internship" && <InternshipForm initial={await getInternshipSettings()} />}
      {tab === "payments" && <PaymentsTab />}
      {tab === "master" && <MasterTab />}
      {tab === "account" && <ChangePasswordForm username={auth.user.username} />}
    </>
  );
}

async function PaymentsTab() {
  const [setting, active] = await Promise.all([getSetting<PaymentSettings>("payments", { gateway: "auto" }), selectGateway()]);
  return <PaymentForm initial={setting.gateway} status={gatewayStatus()} activeGateway={active} envPreference={process.env.PAYMENT_GATEWAY ?? null} />;
}

async function MasterTab() {
  const [options, usage] = await Promise.all([
    prisma.masterOption.findMany({ orderBy: [{ type: "asc" }, { sort: "asc" }, { label: "asc" }] }),
    Promise.all([
      prisma.student.groupBy({ by: ["session"], _count: { _all: true } }),
      prisma.student.groupBy({ by: ["semester"], _count: { _all: true } }),
      prisma.student.groupBy({ by: ["programme"], _count: { _all: true } }),
    ]),
  ]);
  const [bySession, bySemester, byProgramme] = usage;
  const count = (type: string, value: string) => {
    const list = type === "SESSION" ? bySession.map((r) => [r.session, r._count._all] as const) : type === "SEMESTER" ? bySemester.map((r) => [r.semester, r._count._all] as const) : byProgramme.map((r) => [r.programme, r._count._all] as const);
    return list.find(([v]) => v === value)?.[1] ?? 0;
  };
  const rows = options.map((o) => ({ id: o.id, type: o.type, value: o.value, label: o.label, active: o.active, students: count(o.type, o.value) }));
  return <MasterOptionsEditor options={rows} />;
}
