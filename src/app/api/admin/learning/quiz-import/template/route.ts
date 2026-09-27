import ExcelJS from "exceljs";
import { route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { MAX_IMPORT_ROWS } from "@/components/admin/core/learning/server";

const COLUMNS = [
  { header: "Question*", key: "question", width: 60 },
  { header: "Option A*", key: "a", width: 28 },
  { header: "Option B*", key: "b", width: 28 },
  { header: "Option C", key: "c", width: 28 },
  { header: "Option D", key: "d", width: 28 },
  { header: "Correct (A–D)*", key: "correct", width: 15 },
  { header: "Marks", key: "marks", width: 10 },
  { header: "Explanation", key: "explanation", width: 50 },
];

/** Download the quiz question import template (.xlsx). */
export const GET = route(async () => {
  await requireApiRole("ADMIN");
  const wb = new ExcelJS.Workbook();
  wb.creator = "MSY College ERP";
  wb.created = new Date();

  const ws = wb.addWorksheet("Questions", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS;
  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF312E81" } } };
  });
  ws.addRow({
    question: "Which HTML tag is used to create a hyperlink?",
    a: "<link>",
    b: "<a>",
    c: "<href>",
    d: "<url>",
    correct: "B",
    marks: 1,
    explanation: "The anchor tag <a> with an href attribute creates a hyperlink.",
  });
  ws.getRow(2).font = { italic: true, color: { argb: "FF475569" } };
  ws.getColumn("question").alignment = { wrapText: true, vertical: "top" };
  ws.getColumn("explanation").alignment = { wrapText: true, vertical: "top" };

  const last = MAX_IMPORT_ROWS + 1;
  for (let r = 2; r <= last; r++) {
    ws.getCell(`F${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"A,B,C,D"'],
      showErrorMessage: true,
      errorTitle: "Correct answer",
      error: "Enter A, B, C or D.",
    };
    ws.getCell(`G${r}`).dataValidation = {
      type: "whole",
      operator: "between",
      allowBlank: true,
      formulae: [1, 100],
      showErrorMessage: true,
      errorTitle: "Marks",
      error: "Marks must be a whole number from 1 to 100.",
    };
  }

  const help = wb.addWorksheet("Instructions");
  help.getColumn(1).width = 110;
  const lines = [
    "MSY College quiz question import template",
    "",
    "How to fill the Questions sheet",
    "• Keep the header row unchanged. Columns marked * are required.",
    "• One question per row. Replace or delete the sample row before importing.",
    "• Question: the question text (3–1000 characters).",
    "• Option A and Option B are required; Option C and Option D are optional. Fill options in order (do not leave B empty and fill C).",
    "• Correct: the letter of the correct option (A, B, C or D). It must point to a filled option.",
    "• Marks: a whole number from 1 to 100. Leave empty for 1 mark.",
    "• Explanation: optional; shown to students after they submit (when results are visible).",
    "",
    "Importing",
    `• Upload the .xlsx file (up to 10 MB, at most ${MAX_IMPORT_ROWS} questions) from Admin → Learning Setup → chapter → Quiz → Import from Excel.`,
    "• Validate the file first: every row with a problem is listed with its row number and is skipped.",
    "• Append adds the questions after the existing ones. Replace deletes the chapter's existing questions first.",
    "• If the chapter has no quiz yet, one is created with default settings (60% to pass, 3 attempts).",
  ];
  lines.forEach((text, i) => {
    const row = help.addRow([text]);
    if (i === 0) row.font = { bold: true, size: 14, color: { argb: "FF312E81" } };
    else if (text && !text.startsWith("•")) row.font = { bold: true, color: { argb: "FF0F172A" } };
    row.alignment = { wrapText: true };
  });

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="MSY College_Quiz_Questions_Template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
