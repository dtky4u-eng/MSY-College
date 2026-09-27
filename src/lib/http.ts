// API route helpers: uniform JSON envelope, error handling and validation.
//   success → { ok: true, data }
//   failure → { ok: false, error: "message", fields?: { field: "message" } }
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, fields?: Record<string, string>) => new ApiError(400, msg, fields);
export const notFound = (msg = "Not found") => new ApiError(404, msg);
export const forbidden = (msg = "You do not have permission to perform this action.") => new ApiError(403, msg);
export const conflict = (msg: string) => new ApiError(409, msg);

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(status: number, error: string, fields?: Record<string, string>) {
  return NextResponse.json({ ok: false, error, ...(fields ? { fields } : {}) }, { status });
}

type Handler<P> = (req: NextRequest, ctx: { params: Promise<P> }) => Promise<unknown>;

/**
 * Wrap a route handler. Return a Response to send it as-is, or any value to wrap it in { ok, data }.
 *   export const POST = route(async (req) => { ... return { id } })
 */
export function route<P = Record<string, string>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      const result = await handler(req, ctx);
      if (result instanceof Response) return result;
      return ok(result ?? null);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.status, err.message, err.fields);
      // Next.js redirect()/notFound() throw special errors — rethrow them.
      if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
      console.error("[api]", req.method, req.nextUrl.pathname, err);
      return fail(500, "Something went wrong. Please try again.");
    }
  };
}

function zodFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Parse and validate a JSON body. Throws 422 with field messages. */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  return validate(schema, raw);
}

export function validate<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const res = schema.safeParse(raw);
  if (!res.success) {
    const fields = zodFields(res.error);
    const first = Object.values(fields)[0] ?? "Invalid input";
    throw new ApiError(422, first, fields);
  }
  return res.data;
}

/** Convert FormData (non-file entries) to a plain object for zod validation. */
export function formFields(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") out[k] = v;
  });
  return out;
}

export function formFile(form: FormData, key: string): File | null {
  const v = form.get(key);
  return v && typeof v !== "string" && v.size > 0 ? v : null;
}

/** Pagination from ?page=&pageSize= (NFR-7). */
export function pagination(sp: URLSearchParams | Record<string, string | string[] | undefined>, defaultSize = 20) {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k])) ?? undefined;
  const page = Math.max(1, parseInt(get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(5, parseInt(get("pageSize") ?? String(defaultSize), 10) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

// ── Common validators ──
export const zMobile10 = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");
export const zMobile10to15 = z.string().trim().regex(/^\+?\d{10,15}$/, "Mobile must be 10–15 digits");
export const zEmail = z.string().trim().toLowerCase().email("Enter a valid email address");
export const zPincode = z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits");
export const zPassword = z.string().min(8, "Password must be at least 8 characters").max(128);
export const zUsername = z
  .string()
  .trim()
  .min(4, "Username must be at least 4 characters")
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username can contain letters, numbers, dot, dash and underscore");
export const zYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
export const zOptStr = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
