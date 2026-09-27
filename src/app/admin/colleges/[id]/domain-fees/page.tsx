import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { PageHeader, Alert } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { DomainFeesEditor } from "./fees-editor";

export const metadata = { title: "Domain fees" };

export default async function DomainFeesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePageRole("ADMIN");
  const { id } = await params;
  const sp = await searchParams;
  const college = await prisma.college.findUnique({ where: { id }, select: { id: true, name: true, code: true } });
  if (!college) notFound();
  const [domains, fees] = await Promise.all([
    prisma.domain.findMany({ include: { sector: { select: { name: true } } }, orderBy: [{ active: "desc" }, { sector: { name: "asc" } }, { name: "asc" }] }),
    prisma.collegeDomainFee.findMany({ where: { collegeId: id } }),
  ]);
  const feeMap = new Map(fees.map((f) => [f.domainId, f.fee]));

  return (
    <>
      <PageHeader
        back={{ href: "/admin/colleges", label: "Colleges" }}
        title="Domain fees"
        description={
          <>
            Custom internship fees for <b className="text-slate-700">{college.name}</b> (<span className="font-mono">{college.code}</span>). Leave a fee blank to use the domain default.
          </>
        }
        actions={
          <ButtonLink href={`/admin/colleges/${id}/edit`} variant="outline" icon={<Pencil className="size-4" />}>
            Edit college
          </ButtonLink>
        }
      />
      {sp.created === "1" && (
        <Alert tone="success" title="College created" className="mb-5">
          Review the domain fees below. Students of this college pay the default fee unless you set a custom one.
        </Alert>
      )}
      <DomainFeesEditor
        collegeId={id}
        domains={domains.map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          sector: d.sector.name,
          active: d.active,
          defaultFee: d.defaultFee,
          customFee: feeMap.get(d.id) ?? null,
        }))}
      />
    </>
  );
}
