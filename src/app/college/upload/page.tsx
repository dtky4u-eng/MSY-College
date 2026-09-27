import { Download, FileSpreadsheet, History, Info } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCollege } from "@/lib/auth";
import { parseJson } from "@/lib/json";
import { formatDateTime } from "@/lib/format";
import { PageHeader, Alert } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ImportForm } from "./import-form";
import { ImportHistory, type ImportRow } from "./import-history";

export const metadata = { title: "Upload Student Database" };

export default async function UploadPage() {
  const { college } = await requireCollege();
  const imports = await prisma.studentImport.findMany({ where: { collegeId: college.id }, orderBy: { createdAt: "desc" }, take: 25 });
  const rows: ImportRow[] = imports.map((i) => ({
    id: i.id,
    fileName: i.fileName,
    totalRows: i.totalRows,
    imported: i.imported,
    skipped: i.skipped,
    createdAt: formatDateTime(i.createdAt),
    warnings: parseJson<{ row: number; message: string }[]>(i.warnings, []),
  }));

  return (
    <>
      <PageHeader
        title="Upload Student Database"
        description="Import your students from the Excel template. Students can register for their internship only after their record is uploaded."
        actions={
          <ButtonLink href="/api/college/students/template" external variant="outline" icon={<Download className="size-4" />}>
            Download template
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Import students" description="One .xlsx or .xls file, up to 10 MB" icon={<FileSpreadsheet className="size-5" />} />
          <CardBody>
            <ImportForm />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Before you upload" icon={<Info className="size-5" />} />
          <CardBody className="space-y-3 text-sm text-slate-600">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Download the template and keep the header row unchanged.</li>
              <li>
                <b className="text-slate-800">Registration Number</b> and <b className="text-slate-800">Student Name</b> are required. The registration number must match the
                student&apos;s admit card — students use it to start registration.
              </li>
              <li>Mobile numbers must be 10 digits; dates of birth use YYYY-MM-DD.</li>
              <li>Uploading an existing registration number updates that record, unless the student has already confirmed their registration.</li>
            </ol>
            <Alert tone="info">Legacy .xls workbooks may need to be re-saved as .xlsx before importing.</Alert>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Import history" description="Most recent uploads for your college" icon={<History className="size-5" />} />
        <ImportHistory rows={rows} />
      </Card>
    </>
  );
}
