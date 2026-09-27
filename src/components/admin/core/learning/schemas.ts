// Validation schemas for Learning Setup (FR-ADM-8). Shared by the API routes (authoritative)
// and the client forms (instant feedback) — keep this file free of server-only imports.
import { z } from "zod";
import { RESOURCE_TYPES } from "@/lib/constants";
import { isHttpUrl } from "./shared";

const blankToUndefined = (v: unknown) => (v === null || (typeof v === "string" && v.trim() === "") ? undefined : v);

const reqText = (label: string, min: number, max: number) =>
  z
    .string({ message: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

const optText = (label: string, max: number) =>
  z
    .preprocess(blankToUndefined, z.string().trim().max(max, `${label} must be at most ${max} characters`).optional())
    .transform((v) => v ?? null);

const intField = (label: string, min: number, max: number, minMsg?: string) =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ message: `Enter the ${label.toLowerCase()}` })
      .int(`${label} must be a whole number`)
      .min(min, minMsg ?? `${label} must be at least ${min}`)
      .max(max, `${label} cannot exceed ${max}`),
  );

export const zBool = z.preprocess((v) => v === true || v === "true" || v === "1" || v === "on", z.boolean());

export const zId = (label: string) => z.string({ message: `${label} is required` }).trim().min(1, `${label} is required`).max(40);

// ── Sector ──
export const sectorSchema = z.object({
  name: reqText("Sector name", 2, 80),
});

// ── Domain ──
export const domainSchema = z.object({
  code: z
    .string({ message: "Domain code is required" })
    .trim()
    .toUpperCase()
    .min(1, "Domain code is required")
    .min(2, "Domain code must be at least 2 characters")
    .max(16, "Domain code must be at most 16 characters")
    .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "Use uppercase letters, digits and single dashes (e.g. WEB or AI-ML)"),
  name: reqText("Domain name", 2, 120),
  description: optText("Description", 2000),
  sectorId: zId("Sector"),
  durationHours: intField("Duration", 1, 2000, "Duration must be at least 1 hour"),
  defaultFee: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ message: "Enter the default fee" })
      .gt(0, "Fee must be greater than ₹0")
      .max(1000000, "Fee cannot exceed ₹10,00,000")
      .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, "Fee can have at most 2 decimal places"),
  ),
  active: zBool,
  featured: zBool,
});

// ── Module ──
const moduleBase = {
  number: intField("Module number", 1, 999),
  name: reqText("Module name", 2, 150),
  description: optText("Description", 2000),
};
export const moduleCreateSchema = z.object({ domainId: zId("Domain"), ...moduleBase });
export const moduleUpdateSchema = z.object(moduleBase);

// ── Chapter ──
const minutes = (label: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? 0 : v),
    z.coerce
      .number({ message: `Enter the ${label.toLowerCase()} in minutes` })
      .min(0, `${label} cannot be negative`)
      .max(600, `${label} cannot exceed 600 minutes`),
  );
const chapterBase = {
  number: intField("Chapter number", 1, 999),
  name: reqText("Chapter name", 2, 150),
  description: optText("Description", 2000),
  minWatchMinutes: minutes("Minimum watch time"),
  minReadMinutes: minutes("Minimum reading time"),
};
export const chapterCreateSchema = z.object({ moduleId: zId("Module"), ...chapterBase });
export const chapterUpdateSchema = z.object(chapterBase);

// ── Resource (multipart fields; the file itself is validated separately) ──
export const RESOURCE_SOURCES = ["url", "file"] as const;
const resourceBase = z.object({
  type: z.enum(RESOURCE_TYPES, { message: "Choose a resource type" }),
  title: reqText("Title", 2, 200),
  source: z.preprocess(blankToUndefined, z.enum(RESOURCE_SOURCES).optional()),
  url: optText("URL", 2000),
  content: optText("Notes", 50000),
  sortOrder: z.preprocess(blankToUndefined, intField("Sort order", 1, 9999).optional()),
  primary: zBool,
  downloadable: zBool,
});

type ResourceInput = z.infer<typeof resourceBase>;

/** Rules that do not depend on the uploaded file. */
function resourceRules(v: ResourceInput, ctx: z.RefinementCtx) {
  if (v.type === "NOTES") {
    if (!v.content) ctx.addIssue({ code: "custom", path: ["content"], message: "Write the notes content" });
  } else if (v.type === "LINK" || v.source === "url") {
    if (!v.url) ctx.addIssue({ code: "custom", path: ["url"], message: "Enter the resource URL" });
  }
  if (v.url && !isHttpUrl(v.url)) ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a valid http:// or https:// URL" });
}

export const resourceCreateSchema = resourceBase.extend({ chapterId: zId("Chapter") }).superRefine(resourceRules);
export const resourceUpdateSchema = resourceBase.superRefine(resourceRules);

export const moveSchema = z.object({ direction: z.enum(["up", "down"], { message: "Choose a direction" }) });

// ── Quiz ──
export const quizSchema = z.object({
  chapterId: zId("Chapter"),
  title: reqText("Quiz title", 2, 150),
  description: optText("Description", 2000),
  passingScore: intField("Passing score", 0, 100, "Passing score cannot be negative"),
  attemptsAllowed: intField("Attempts allowed", 1, 20),
  timeLimitMinutes: z
    .preprocess(blankToUndefined, intField("Time limit", 1, 600, "Time limit must be at least 1 minute").optional())
    .transform((v) => v ?? null),
  randomize: zBool,
  showResult: zBool,
});

// ── Question ──
const questionBase = z.object({
  text: reqText("Question", 3, 1000),
  options: z
    .array(z.string({ message: "Option text is required" }).trim().min(1, "Option text is required").max(300, "Option must be at most 300 characters"), {
      message: "Add the answer options",
    })
    .min(2, "Add at least 2 options")
    .max(6, "A question can have at most 6 options"),
  correctIndex: z.coerce.number({ message: "Choose the correct answer" }).int("Choose the correct answer").min(0, "Choose the correct answer"),
  marks: intField("Marks", 1, 100),
  explanation: optText("Explanation", 1000),
});

function questionRules(v: z.infer<typeof questionBase>, ctx: z.RefinementCtx) {
  if (v.correctIndex >= v.options.length) ctx.addIssue({ code: "custom", path: ["correctIndex"], message: "Choose the correct answer" });
  const seen = new Map<string, number>();
  v.options.forEach((o, i) => {
    const k = o.toLowerCase();
    if (seen.has(k)) ctx.addIssue({ code: "custom", path: ["options", i], message: "This option duplicates another option" });
    else seen.set(k, i);
  });
}

export const questionCreateSchema = questionBase.extend({ quizId: zId("Quiz") }).superRefine(questionRules);
export const questionUpdateSchema = questionBase.superRefine(questionRules);

export const IMPORT_MODES = ["append", "replace"] as const;
export const quizImportSchema = z.object({
  chapterId: zId("Chapter"),
  mode: z.enum(IMPORT_MODES, { message: "Choose append or replace" }),
  dryRun: zBool,
});

/** Validate on the client and return a field → message map (empty when valid). */
export function checkFields(schema: z.ZodType, value: unknown): Record<string, string> {
  const res = schema.safeParse(value);
  if (res.success) return {};
  const fields: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
