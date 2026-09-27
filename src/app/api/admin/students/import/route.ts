import path from "node:path";
import { prisma } from "@/lib/db";
import { ApiError, formFile, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { KIND_SETS, sniffKind } from "@/lib/files";
import { importStudents } from "@/lib/excel";
import { LIMITS } from "@/lib/constants";
import { audit } from "@/lib/audit";

const fieldError = (field: string, message: string) => new ApiError(422, message, { [field]: message });

/** Import students from an Excel file into the selected college (FR-ADM-6, NFR-6). Multipart: collegeId, file. */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "Upload the Excel file as multipart form data");
  }

  const collegeId = String(form.get("collegeId") ?? "").trim();
  if (!collegeId) throw fieldError("collegeId", "Select the college these students belong to");
  const college = await prisma.college.findUnique({ where: { id: collegeId }, select: { id: true, name: true, code: true } });
  if (!college) throw fieldError("collegeId", "The selected college no longer exists");

  const file = formFile(form, "file");
  if (!file) throw fieldError("file", "Choose an Excel file to upload");
  const ext = path.extname(file.name).toLowerCase();
  if (ext !== ".xlsx" && ext !== ".xls") throw fieldError("file", "Only .xlsx or .xls files are accepted");
  if (file.size > LIMITS.excelBytes) throw fieldError("file", "The Excel file must be 10 MB or smaller");
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) throw fieldError("file", "The uploaded file is empty");
  const kind = sniffKind(buf, file.name);
  if (!kind || !KIND_SETS.excel.includes(kind)) throw fieldError("file", "The file is not a valid Excel workbook");

  const fileName = path.basename(file.name).slice(0, 150);
  const result = await importStudents(college.id, buf, { userId: auth.user.id, fileName });
  await audit(auth.user.id, "STUDENT_IMPORT", "College", college.id, {
    via: "ADMIN",
    college: college.code,
    fileName,
    totalRows: result.totalRows,
    imported: result.imported,
    updated: result.updated,
    skipped: result.skipped,
    warnings: result.warnings.length,
  });
  return { ...result, college: { id: college.id, name: college.name } };
});
