// Server-side helpers for Learning Setup (FR-ADM-8): usage checks that block unsafe deletes,
// sort-order maintenance, file cleanup and the quiz Excel import parser.
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, conflict } from "@/lib/http";
import { KIND_SETS, deleteStoredFile, type FileKind } from "@/lib/files";
import { readSheetObjects } from "@/lib/excel";
import { OPTION_LETTERS, plural } from "./shared";

/** Throw a friendly 409 for unique-constraint violations (target column → form field). */
export function rethrowUnique(err: unknown, fields: Record<string, { field: string; message: string }>): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = ([] as string[]).concat((err.meta?.target as string[] | string | undefined) ?? []).join(",");
    for (const [col, f] of Object.entries(fields)) {
      if (target.includes(col)) throw new ApiError(409, f.message, { [f.field]: f.message });
    }
    const first = Object.values(fields)[0];
    if (first) throw new ApiError(409, first.message, { [first.field]: first.message });
    throw new ApiError(409, "A record with these details already exists.");
  }
  throw err;
}

export async function readForm(req: Request): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw new ApiError(400, "Invalid form data");
  }
}

/** Sector names are unique regardless of letter case. */
export async function assertSectorNameFree(name: string, exceptId?: string) {
  const all = await prisma.sector.findMany({ select: { id: true, name: true } });
  if (all.some((s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, "A sector with this name already exists", { name: "A sector with this name already exists" });
  }
}

function listParts(parts: (string | false | 0)[]): string {
  const p = parts.filter(Boolean) as string[];
  if (p.length <= 1) return p.join("");
  return `${p.slice(0, -1).join(", ")} and ${p[p.length - 1]}`;
}

// ── Delete protection ──

async function learningActivity(chapterWhere: Prisma.ChapterWhereInput) {
  const [progressStudents, attempts, liveClasses] = await Promise.all([
    prisma.chapterProgress.findMany({ where: { chapter: chapterWhere }, select: { studentId: true }, distinct: ["studentId"] }),
    prisma.quizAttempt.count({ where: { quiz: { chapter: chapterWhere } } }),
    prisma.liveClass.count({ where: { chapter: chapterWhere } }),
  ]);
  return { progressStudents: progressStudents.length, attempts, liveClasses };
}

/** Reject deleting a domain that is in use. */
export async function assertDomainDeletable(domainId: string) {
  const d = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { _count: { select: { students: true, mentors: true, assignments: true, liveClasses: true, routines: true } } },
  });
  if (!d) return;
  const act = await learningActivity({ module: { domainId } });
  const c = d._count;
  const parts = [
    c.students > 0 && plural(c.students, "student"),
    c.mentors > 0 && plural(c.mentors, "mentor"),
    c.assignments > 0 && plural(c.assignments, "assignment"),
    c.liveClasses > 0 && plural(c.liveClasses, "live class", "live classes"),
    c.routines > 0 && plural(c.routines, "routine"),
    !c.students && act.progressStudents > 0 && `learning progress from ${plural(act.progressStudents, "student")}`,
    !c.students && act.attempts > 0 && plural(act.attempts, "quiz attempt"),
  ];
  const text = listParts(parts);
  if (text) throw conflict(`This domain has ${text} and cannot be deleted. Mark it inactive instead.`);
}

export async function assertModuleDeletable(moduleId: string) {
  const [act, moduleLive] = await Promise.all([learningActivity({ moduleId }), prisma.liveClass.count({ where: { moduleId, chapterId: null } })]);
  const live = act.liveClasses + moduleLive;
  const text = listParts([
    act.progressStudents > 0 && `learning progress from ${plural(act.progressStudents, "student")}`,
    act.attempts > 0 && plural(act.attempts, "quiz attempt"),
    live > 0 && plural(live, "linked live class", "linked live classes"),
  ]);
  if (text) throw conflict(`This module has ${text} and cannot be deleted. Edit its content instead.`);
}

export async function assertChapterDeletable(chapterId: string) {
  const act = await learningActivity({ id: chapterId });
  const text = listParts([
    act.progressStudents > 0 && `learning progress from ${plural(act.progressStudents, "student")}`,
    act.attempts > 0 && plural(act.attempts, "quiz attempt"),
    act.liveClasses > 0 && plural(act.liveClasses, "linked live class", "linked live classes"),
  ]);
  if (text) throw conflict(`This chapter has ${text} and cannot be deleted. Edit its content instead.`);
}

/** Uploaded resource files under a set of chapters (deleted from storage after a cascade delete). */
export async function resourceFileIds(chapterWhere: Prisma.ChapterWhereInput): Promise<string[]> {
  const rows = await prisma.resource.findMany({ where: { chapter: chapterWhere, fileId: { not: null } }, select: { fileId: true } });
  return rows.map((r) => r.fileId!).filter(Boolean);
}

export async function deleteFiles(ids: (string | null | undefined)[]) {
  for (const id of ids) {
    try {
      await deleteStoredFile(id);
    } catch {
      // Storage cleanup is best-effort; the database change has already been committed.
    }
  }
}

// ── Ordering ──

/** Re-sequence a chapter's resources to 1..n, optionally placing one resource at `position` (1-based). */
export async function resequenceResources(chapterId: string, movedId?: string, position?: number) {
  const rows = await prisma.resource.findMany({ where: { chapterId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, sortOrder: true } });
  const ordered = placeAt(rows, movedId, position);
  await prisma.$transaction(ordered.filter((r, i) => r.sortOrder !== i + 1).map((r) => prisma.resource.update({ where: { id: r.id }, data: { sortOrder: ordered.indexOf(r) + 1 } })));
}

export async function resequenceQuestions(quizId: string, movedId?: string, position?: number) {
  const rows = await prisma.question.findMany({ where: { quizId }, orderBy: [{ sort: "asc" }, { id: "asc" }], select: { id: true, sort: true } });
  const ordered = placeAt(rows.map((r) => ({ id: r.id, sortOrder: r.sort })), movedId, position);
  await prisma.$transaction(ordered.filter((r, i) => r.sortOrder !== i + 1).map((r) => prisma.question.update({ where: { id: r.id }, data: { sort: ordered.indexOf(r) + 1 } })));
}

function placeAt<T extends { id: string; sortOrder: number }>(rows: T[], movedId?: string, position?: number): T[] {
  if (!movedId || position === undefined) return rows;
  const idx = rows.findIndex((r) => r.id === movedId);
  if (idx < 0) return rows;
  const next = rows.slice();
  const [item] = next.splice(idx, 1);
  const at = Math.min(Math.max(position - 1, 0), next.length);
  next.splice(at, 0, item!);
  return next;
}

/** Current 1-based position after a swap with the neighbour. */
export function neighbourPosition<T extends { id: string }>(rows: T[], id: string, direction: "up" | "down"): number | null {
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= rows.length) return null;
  return target + 1;
}

// ── Resource file kinds ──

export const RESOURCE_FILE_KINDS: Record<string, FileKind[]> = {
  VIDEO: ["mp4"],
  PDF: ["pdf"],
  NOTES: ["pdf", "doc", "docx", "txt"],
  CODE: ["zip", "txt"],
  LINK: [],
  OTHER: KIND_SETS.resource,
};

// ── Quiz Excel import ──

export type ImportField = "text" | "a" | "b" | "c" | "d" | "e" | "f" | "correct" | "marks" | "explanation";

const HEADER_MAP: Record<string, ImportField> = {
  question: "text",
  questions: "text",
  "question text": "text",
  "question statement": "text",
  correct: "correct",
  "correct answer": "correct",
  "correct option": "correct",
  answer: "correct",
  "answer key": "correct",
  key: "correct",
  marks: "marks",
  mark: "marks",
  points: "marks",
  score: "marks",
  explanation: "explanation",
  explanations: "explanation",
  solution: "explanation",
  reason: "explanation",
  remarks: "explanation",
};
OPTION_LETTERS.forEach((L, i) => {
  const l = L.toLowerCase() as ImportField;
  HEADER_MAP[`option ${l}`] = l;
  HEADER_MAP[`option ${i + 1}`] = l;
  HEADER_MAP[`opt ${l}`] = l;
  HEADER_MAP[l] = l;
});

/** Lower-case, drop "(…)" hints and punctuation, collapse spaces: "Correct (A–D)*" → "correct". */
export function normaliseHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ParsedQuestion {
  row: number;
  text: string;
  options: string[];
  correctIndex: number;
  marks: number;
  explanation: string | null;
}

export interface ImportIssue {
  row: number;
  message: string;
}

export const MAX_IMPORT_ROWS = 500;

export async function parseQuizWorkbook(buf: Buffer): Promise<{ totalRows: number; valid: ParsedQuestion[]; errors: ImportIssue[] }> {
  let rows: Awaited<ReturnType<typeof readSheetObjects>>;
  try {
    rows = await readSheetObjects(buf);
  } catch {
    throw new ApiError(422, "Could not read the Excel file. Please upload an .xlsx file based on the template.", { file: "Could not read the Excel file" });
  }
  if (rows.length === 0) {
    throw new ApiError(422, "The first sheet has no question rows. Fill in the template below the header row.", { file: "No question rows found" });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ApiError(422, `A file can contain at most ${MAX_IMPORT_ROWS} questions (found ${rows.length}).`, { file: `At most ${MAX_IMPORT_ROWS} questions per file` });
  }

  // Map raw header keys → fields using the first row's keys (every header is present on each row).
  const keyMap = new Map<string, ImportField>();
  for (const raw of Object.keys(rows[0]!.values)) {
    const f = HEADER_MAP[normaliseHeader(raw)];
    if (f && ![...keyMap.values()].includes(f)) keyMap.set(raw, f);
  }
  const have = new Set(keyMap.values());
  const missing = [
    !have.has("text") && "Question",
    !have.has("a") && "Option A",
    !have.has("b") && "Option B",
    !have.has("correct") && "Correct",
  ].filter(Boolean) as string[];
  if (missing.length) {
    const msg = `The header row is missing: ${missing.join(", ")}. Download the template and keep its header row unchanged.`;
    throw new ApiError(422, msg, { file: msg });
  }

  const valid: ParsedQuestion[] = [];
  const errors: ImportIssue[] = [];
  const seenText = new Map<string, number>();
  const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

  for (const { row, values } of rows) {
    const rec: Partial<Record<ImportField, string>> = {};
    keyMap.forEach((field, raw) => (rec[field] = clean(values[raw])));
    const problems: string[] = [];

    const text = rec.text ?? "";
    if (!text) problems.push("Question text is empty");
    else if (text.length < 3) problems.push("Question text is too short");
    else if (text.length > 1000) problems.push("Question text exceeds 1000 characters");

    const cells = OPTION_LETTERS.map((L) => rec[L.toLowerCase() as ImportField] ?? "");
    let last = -1;
    cells.forEach((c, i) => c && (last = i));
    const options = cells.slice(0, last + 1);
    const gap = options.findIndex((o) => !o);
    if (last < 1) problems.push("At least 2 options (Option A and Option B) are required");
    else if (gap >= 0) problems.push(`Option ${OPTION_LETTERS[gap]} is empty but a later option is filled — fill options in order`);
    const tooLong = options.findIndex((o) => o.length > 300);
    if (tooLong >= 0) problems.push(`Option ${OPTION_LETTERS[tooLong]} exceeds 300 characters`);
    const lower = options.map((o) => o.toLowerCase()).filter(Boolean);
    if (new Set(lower).size !== lower.length) problems.push("Two options have the same text");

    const correctRaw = (rec.correct ?? "").toUpperCase().replace(/^OPTION\s*/, "").trim();
    let correctIndex = -1;
    if (!correctRaw) problems.push("Correct answer is empty — enter a letter such as A");
    else {
      if (/^[A-F]$/.test(correctRaw)) correctIndex = OPTION_LETTERS.indexOf(correctRaw as (typeof OPTION_LETTERS)[number]);
      else if (/^[1-6]$/.test(correctRaw)) correctIndex = Number(correctRaw) - 1;
      if (correctIndex < 0) problems.push(`Correct answer "${rec.correct}" is not a valid option letter (A–F)`);
      else if (!cells[correctIndex]) problems.push(`Correct answer ${OPTION_LETTERS[correctIndex]} points to an empty option`);
    }

    let marks = 1;
    if (rec.marks) {
      const n = Number(rec.marks);
      if (!Number.isInteger(n) || n < 1 || n > 100) problems.push(`Marks "${rec.marks}" must be a whole number from 1 to 100`);
      else marks = n;
    }
    const explanation = rec.explanation ? rec.explanation.slice(0, 1000) : null;

    if (!problems.length && text) {
      const k = text.toLowerCase();
      const dup = seenText.get(k);
      if (dup) problems.push(`Duplicate of the question in row ${dup}`);
      else seenText.set(k, row);
    }

    if (problems.length) errors.push({ row, message: problems.join("; ") });
    else valid.push({ row, text, options, correctIndex, marks, explanation });
  }
  return { totalRows: rows.length, valid, errors };
}
