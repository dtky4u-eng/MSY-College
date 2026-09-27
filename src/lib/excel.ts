// Excel import (college student database — FR-COL-2, FR-ADM-6) and export (reports — FR-ADM-14).
import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "./db";
import { newStudentCode } from "./ids";
import { ApiError } from "./http";
import type { ExportColumn } from "./pdf/table";

export const STUDENT_TEMPLATE_COLUMNS = [
  { key: "registrationNumber", header: "Registration Number*", width: 24, note: "University/College registration number from the admit card" },
  { key: "name", header: "Student Name*", width: 28 },
  { key: "rollNumber", header: "Roll Number", width: 16 },
  { key: "fatherName", header: "Father Name", width: 24 },
  { key: "gender", header: "Gender (Male/Female/Other)", width: 14 },
  { key: "dob", header: "Date of Birth (YYYY-MM-DD)", width: 18 },
  { key: "programme", header: "Programme", width: 18 },
  { key: "majorSubject", header: "Major Subject", width: 20 },
  { key: "session", header: "Session (e.g. 2024-28)", width: 14 },
  { key: "semester", header: "Semester", width: 10 },
  { key: "mobile", header: "Mobile", width: 14 },
  { key: "email", header: "Email", width: 26 },
] as const;

type Key = (typeof STUDENT_TEMPLATE_COLUMNS)[number]["key"];

export async function studentTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MSY College ERP";
  const ws = wb.addWorksheet("Students");
  ws.columns = STUDENT_TEMPLATE_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
  ws.addRow({ registrationNumber: "23BCA0101", name: "Aarav Kumar", rollNumber: "101", fatherName: "Rakesh Kumar", gender: "Male", dob: "2004-05-14", programme: "BCA", majorSubject: "Computer Applications", session: "2023-27", semester: "5", mobile: "9876543210", email: "aarav@example.com" });
  const help = wb.addWorksheet("Instructions");
  help.addRows([
    ["MSY College student database template"],
    [""],
    ["• Columns marked * are required. Keep the header row unchanged."],
    ["• Registration Number must match the number printed on the student's admit card. Students use it to register."],
    ["• Existing registration numbers are updated (unless the student has already confirmed registration)."],
    ["• One sheet, up to 10 MB, .xlsx or .xls."],
  ]);
  help.getColumn(1).width = 110;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const HEADER_ALIASES: Record<string, Key> = {
  "registration number": "registrationNumber",
  "registration no": "registrationNumber",
  "reg no": "registrationNumber",
  "university registration number": "registrationNumber",
  "student name": "name",
  name: "name",
  "roll number": "rollNumber",
  "roll no": "rollNumber",
  "father name": "fatherName",
  "father's name": "fatherName",
  gender: "gender",
  "date of birth": "dob",
  dob: "dob",
  programme: "programme",
  program: "programme",
  course: "programme",
  "major subject": "majorSubject",
  major: "majorSubject",
  session: "session",
  semester: "semester",
  sem: "semester",
  mobile: "mobile",
  "mobile number": "mobile",
  phone: "mobile",
  email: "email",
  "email id": "email",
};

function normHeader(h: string): Key | null {
  const k = h.toLowerCase().replace(/\*/g, "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  return HEADER_ALIASES[k] ?? null;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("hyperlink" in v) return String((v as { text?: string }).text ?? "");
  }
  return String(v).trim();
}

export interface ImportWarning {
  row: number;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  warnings: ImportWarning[];
}

function parseGender(g: string): string | null {
  const x = g.toLowerCase();
  if (["m", "male", "boy"].includes(x)) return "MALE";
  if (["f", "female", "girl"].includes(x)) return "FEMALE";
  if (x) return "OTHER";
  return null;
}

function parseDob(s: string): Date | null {
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(`${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}T00:00:00+05:30`);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}T00:00:00+05:30`);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Import students for a college from an Excel buffer. Row numbers in warnings are 1-based sheet rows. */
export async function importStudents(collegeId: string, buf: Buffer, actor: { userId: string; fileName: string }): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new ApiError(422, "Could not read the Excel file. Please use the .xlsx template (legacy .xls files must be re-saved as .xlsx).");
  }
  const ws = wb.worksheets[0];
  const result: ImportResult = { totalRows: 0, imported: 0, updated: 0, skipped: 0, warnings: [] };
  if (!ws) return result;

  const headerRow = ws.getRow(1);
  const colMap = new Map<number, Key>();
  headerRow.eachCell((cell, col) => {
    const k = normHeader(cellText(cell.value));
    if (k) colMap.set(col, k);
  });
  const mapped = new Set(colMap.values());
  if (!mapped.has("registrationNumber") || !mapped.has("name")) {
    result.warnings.push({ row: 1, message: "Header row must include 'Registration Number' and 'Student Name' columns (download the template)." });
    return result;
  }

  const seen = new Set<string>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const rec: Partial<Record<Key, string>> = {};
    let any = false;
    colMap.forEach((key, col) => {
      const t = cellText(row.getCell(col).value);
      if (t) any = true;
      rec[key] = t;
    });
    if (!any) continue;
    result.totalRows++;
    const regNo = (rec.registrationNumber ?? "").toUpperCase().replace(/\s+/g, "");
    const name = (rec.name ?? "").replace(/\s+/g, " ").trim();
    if (!regNo) {
      result.skipped++;
      result.warnings.push({ row: r, message: "Missing registration number — row skipped" });
      continue;
    }
    if (!name) {
      result.skipped++;
      result.warnings.push({ row: r, message: `${regNo}: missing student name — row skipped` });
      continue;
    }
    if (seen.has(regNo)) {
      result.skipped++;
      result.warnings.push({ row: r, message: `${regNo}: duplicate in this file — row skipped` });
      continue;
    }
    seen.add(regNo);

    const mobile = (rec.mobile ?? "").replace(/\D/g, "").slice(-10);
    if (rec.mobile && mobile.length !== 10) result.warnings.push({ row: r, message: `${regNo}: mobile '${rec.mobile}' is not 10 digits — left blank` });
    const email = (rec.email ?? "").toLowerCase();
    const emailOk = !email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!emailOk) result.warnings.push({ row: r, message: `${regNo}: invalid email '${email}' — left blank` });
    const dob = parseDob(rec.dob ?? "");
    if (rec.dob && !dob) result.warnings.push({ row: r, message: `${regNo}: could not read date of birth '${rec.dob}'` });

    const data = {
      name,
      rollNumber: rec.rollNumber || null,
      fatherName: rec.fatherName || null,
      gender: parseGender(rec.gender ?? ""),
      dob,
      programme: rec.programme || null,
      majorSubject: rec.majorSubject || null,
      session: rec.session || null,
      semester: rec.semester ? rec.semester.replace(/\D/g, "") || rec.semester : null,
      mobile: mobile.length === 10 ? mobile : null,
      email: emailOk && email ? email : null,
    };

    const existing = await prisma.student.findUnique({ where: { registrationNumber: regNo } });
    if (existing) {
      if (existing.collegeId !== collegeId) {
        result.skipped++;
        result.warnings.push({ row: r, message: `${regNo}: already registered under another college — row skipped` });
        continue;
      }
      if (existing.registrationLocked) {
        result.skipped++;
        result.warnings.push({ row: r, message: `${regNo}: student has already confirmed registration — not updated` });
        continue;
      }
      await prisma.student.update({ where: { id: existing.id }, data });
      result.updated++;
      continue;
    }
    await prisma.student.create({ data: { ...data, registrationNumber: regNo, collegeId, studentCode: await newStudentCode() } });
    result.imported++;
  }

  await prisma.studentImport.create({
    data: {
      collegeId,
      fileName: actor.fileName,
      totalRows: result.totalRows,
      imported: result.imported + result.updated,
      skipped: result.skipped,
      warnings: JSON.stringify(result.warnings.slice(0, 500)),
      importedBy: actor.userId,
    },
  });
  return result;
}

/** Export rows to a styled .xlsx buffer. */
export async function rowsToExcel(sheetName: string, columns: ExportColumn[], rows: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MSY College ERP";
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, (c.width ?? 1) * 14) }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of rows) ws.addRow(Object.fromEntries(columns.map((c) => [c.key, r[c.key] ?? ""])));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Parse a generic sheet into objects keyed by lower-cased header (used by quiz import). */
export async function readSheetObjects(buf: Buffer): Promise<{ row: number; values: Record<string, string> }[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => (headers[col] = cellText(cell.value).toLowerCase().replace(/\*/g, "").trim()));
  const out: { row: number; values: Record<string, string> }[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const values: Record<string, string> = {};
    let any = false;
    headers.forEach((h, col) => {
      if (!h) return;
      const t = cellText(row.getCell(col).value);
      if (t) any = true;
      values[h] = t;
    });
    if (any) out.push({ row: r, values });
  }
  return out;
}
