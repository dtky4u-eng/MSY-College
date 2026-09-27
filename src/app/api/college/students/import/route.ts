import path from "node:path";
import { ApiError, formFile, route } from "@/lib/http";
import { requireCollege } from "@/lib/auth";
import { KIND_SETS, sniffKind } from "@/lib/files";
import { importStudents } from "@/lib/excel";
import { LIMITS } from "@/lib/constants";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";

/** Import students from one .xlsx/.xls file up to 10 MB (FR-COL-2, NFR-6). */
export const POST = route(async (req) => {
  const { college, auth } = await requireCollege("api");
  rateLimit(`college-import:${college.id}`, 20, 60 * 60 * 1000);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "Upload the Excel file as multipart form data");
  }
  const file = formFile(form, "file");
  if (!file) throw new ApiError(422, "Choose an Excel file to upload", { file: "Choose an Excel file to upload" });
  const ext = path.extname(file.name).toLowerCase();
  if (ext !== ".xlsx" && ext !== ".xls") throw new ApiError(422, "Only .xlsx or .xls files are accepted", { file: "Only .xlsx or .xls files are accepted" });
  if (file.size > LIMITS.excelBytes) throw new ApiError(422, "The Excel file must be 10 MB or smaller", { file: "The Excel file must be 10 MB or smaller" });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) throw new ApiError(422, "The uploaded file is empty", { file: "The uploaded file is empty" });
  const kind = sniffKind(buf, file.name);
  if (!kind || !KIND_SETS.excel.includes(kind)) throw new ApiError(422, "The file is not a valid Excel workbook", { file: "The file is not a valid Excel workbook" });

  const fileName = path.basename(file.name).slice(0, 150);
  const result = await importStudents(college.id, buf, { userId: auth.user.id, fileName });
  await audit(auth.user.id, "STUDENT_IMPORT", "College", college.id, {
    fileName,
    totalRows: result.totalRows,
    imported: result.imported,
    updated: result.updated,
    skipped: result.skipped,
    warnings: result.warnings.length,
  });
  return result;
});
