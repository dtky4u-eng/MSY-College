# MSY College ERP — Developer Guide

Implementation of the *MSY College ERP — Application Requirements Specification* (NEP 2020 / CBCS internship lifecycle).
Requirement IDs (FR-*, AR-*, NFR-*, WF-*, G-*) below refer to that spec.

## Stack

- **Next.js 15 (App Router) + React 19 + TypeScript**, **Tailwind CSS v4** (`src/app/globals.css` holds the theme — brand colour scale `brand-50…950`, `accent-400/500`, `shadow-card`, `shadow-pop`, `font-display`).
- **Prisma 6 + SQLite** (`prisma/schema.prisma`, db file `prisma/dev.db`). String columns emulate enums; allowed values are in `src/lib/constants.ts`. JSON is stored as strings → `parseJson()` from `src/lib/json.ts`.
- **Money is always paise (Int)**. Show with `formatINR(paise)`; convert input with `rupeesToPaise()`.
- **Dates**: calendar dates (attendance/logbook) are `"YYYY-MM-DD"` strings in IST. Use helpers in `src/lib/format.ts` (`toISTDateString`, `istDate`, `formatDate`, `formatDateTime`, `workingDaysBetween`, `relativeTime`…).
- Icons: `lucide-react`. Charts: `src/components/ui/charts.tsx` (recharts wrappers).
- PDFs: `pdf-lib` via `src/lib/pdf/kit.ts`; Excel: `exceljs` via `src/lib/excel.ts`; ZIP: `jszip`; QR: `qrcode`.

Run: `npm run dev` (port 3000). Type-check: `npx tsc --noEmit`. **Do not run `next build`, `db:reset` or `db:seed` while the shared dev server is running.**

## Architecture pattern (follow it everywhere)

**Pages are Server Components** that read data directly with Prisma after a guard, then render UI. Interactive bits are small
**Client Components** (`"use client"`) colocated next to the page (e.g. `app/admin/colleges/college-form.tsx`) that call REST
API routes with `api()` and then `router.refresh()` (use the `useAction()` hook which does toast + refresh).

```tsx
// app/mentor/students/page.tsx (server)
import { requireMentor } from "@/lib/auth";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;                  // Next 15: params & searchParams are Promises
  const { mentor } = await requireMentor();       // redirects if not a mentor
  const rows = await prisma.student.findMany({ where: { mentorId: mentor.id } });
  return <>...</>;
}
```

```ts
// app/api/mentor/reviews/[id]/route.ts
import { z } from "zod";
import { route, parseBody, ApiError } from "@/lib/http";
import { requireMentor } from "@/lib/auth";
const schema = z.object({ decision: z.enum(["APPROVED", "RESUBMIT"]), feedback: z.string().trim().max(2000).optional() });
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { mentor, auth } = await requireMentor("api");   // throws 401/403 — NFR-1 server-side checks on EVERY endpoint
  const body = await parseBody(req, schema);             // throws 422 with per-field messages
  ...
  return { ok: true };                                   // wrapped as { ok: true, data }
});
```

```tsx
// client component
"use client";
const { run, loading, fields } = useAction();
await run(() => api("/api/mentor/reviews/" + id, { body: { decision, feedback } }), { success: "Review saved", refresh: true });
// multipart: api(url, { form: formData })
```

API envelope: success `{ ok: true, data }`, error `{ ok: false, error, fields? }`. `ApiClientError` carries `.status` and `.fields`
(map of field → message; show them under inputs with `<Field error={fields.name}>`).

### Guards & auth (`src/lib/auth.ts`)

- Pages: `requirePageRole("ADMIN")`, `requireStudent()`, `requireCollege()`, `requireMentor()` → return `{ auth, student|college|mentor }`.
- API: same functions with `"api"` argument (`requireStudent("api")`) or `requireApiRole("ADMIN")`.
- `auth.user` = `{ id, username, email, role, name }`, `auth.sessionId`.
- `hashPassword`, `verifyPassword`, `revokeAllSessions(userId)` (call after an admin/college changes someone's password).
- Data scope rules: college sees only `collegeId = college.id` (AR-5); mentor only `mentorId = mentor.id` and own `domainId` (AR-6). Enforce in every query **and** every mutation (look the record up with the scope in the `where`).

### Shared libraries (import, don't duplicate)

| Module | What it gives you |
|---|---|
| `lib/db.ts` | `prisma` |
| `lib/http.ts` | `route`, `ApiError`, `badRequest/notFound/forbidden/conflict`, `parseBody`, `validate`, `formFields`, `formFile`, `pagination`, validators `zMobile10`, `zMobile10to15`, `zEmail`, `zPincode`, `zPassword`, `zUsername`, `zYmd`, `zOptStr` |
| `lib/files.ts` | `saveUpload(file, { purpose, allowed: KIND_SETS.x, maxBytes: LIMITS.x, ownerUserId, studentId, label })` (magic-byte sniffing, NFR-6), `saveGenerated`, `readStoredFile`, `deleteStoredFile`, `fileUrl(id, download?)` → `/api/files/:id` (access-checked, NFR-11), `KIND_SETS` |
| `lib/constants.ts` | roles, statuses & labels, `ASSESSMENT_CRITERIA`, `RATINGS`, `DOCUMENT_TYPES/LABEL`, `BULK_OPERATIONS`, `SETTLEMENT_MODES`, `GENDERS`, `ORG`, `LIMITS` |
| `lib/student.ts` | `accessState(student)` + `ACCESS_STATE_LABEL` (FR-STU-2), `attendanceStats`, `learningTree(studentId, domainId)` (sequential unlock, quiz attempt info), `quizAttemptInfo`, `isChapterUnlocked`, `markChapterComplete`, `learningPercentMany`, `studentProgress(studentId)` (dashboard summary + eligibility checks), `assessmentScore(ratings)`, `gradeFor`, `computeResult`, `publishResult`, `issueCertificate`, `completeInternship`, `defaultEndDate` |
| `lib/payments/index.ts` | `selectGateway`, `gatewayStatus`, `createOrderForStudent`, `verifyPayment`, `refreshPaymentStatus`, `markPaymentSuccess` (idempotent activation; pass `manual: { actorId, reason }` for admin mark-paid), `sandboxComplete`, `handleRazorpayWebhook`, `handleCashfreeWebhook`, `appUrl` |
| `lib/pdf/documents.ts` | `documentAvailability(studentId)`, `renderStudentDocument(studentId, type, { force })`, `renderReceipt(paymentId)`, `verifyUrl(code)` |
| `lib/pdf/table.ts` | `rowsToPdf(title, columns, rows)` |
| `lib/excel.ts` | `studentTemplate()`, `importStudents(collegeId, buffer, { userId, fileName })`, `rowsToExcel(sheet, columns, rows)`, `readSheetObjects(buffer)` |
| `lib/fees.ts` | `effectiveFee(collegeId, domainId)`, `domainsWithFees(collegeId)` |
| `lib/settings.ts` | `getSetting/setSetting`, `getEligibilityRules`, `getInternshipSettings`, `DEFAULT_ELIGIBILITY`, `nextSequence` |
| `lib/ids.ts` | `newStudentCode`, `newPortalRegNo`, `newReceiptNo`, `newCertificateNo`, `newTransactionId`, `newVerifyCode` |
| `lib/audit.ts` | `audit(actorId, action, entity, entityId, details)` — REQUIRED for admin/college actions on payments, student status, passwords, bulk jobs, settlements (NFR-5) |
| `lib/notify.ts` | `notify(userIds, { title, body, kind, link })` |
| `lib/mail.ts` | `sendMail({ to, subject, text })` (writes to `storage/outbox`) |
| `lib/ratelimit.ts` | `rateLimit(key, limit, windowMs)` |
| `lib/i18n` | `getT()` (server), `useT()` / `I18nProvider` / `LanguageToggle` (client, `components/i18n.tsx`) |
| `lib/client/api.ts` | `api()`, `ApiClientError`, `download(url)` |
| `lib/client/hooks.ts` | `useAction()` |

Existing endpoints: `POST /api/auth/login|logout|refresh|change-password`, `GET /api/auth/me`, `GET /api/notifications`,
`POST /api/notifications/read`, `GET /api/files/:id[?download=1]`, `GET /api/documents/:studentId/:type[?inline=1]`
(type = offer_letter | acceptance_letter | attendance_sheet | logbook | report | marksheet | certificate),
`GET /api/payments/:id/receipt`.

### UI kit (`src/components/ui/*`)

`button.tsx` (`Button`, `ButtonLink`, `buttonClass`; variants primary/secondary/outline/ghost/danger/success/white; sizes xs/sm/md/lg; `loading`, `icon`) ·
`field.tsx` (`Field`, `Label`, `Input` (with `leading` icon), `Textarea`, `Select`, `Checkbox`, `Switch`) ·
`card.tsx` (`Card`, `CardHeader` (title/description/actions/icon), `CardBody`, `CardFooter`) ·
`badge.tsx` (`Badge` tones, `StatusBadge status="PAID"` knows every status) ·
`table.tsx` (`Table`, `THead`, `TBody`, `TR`, `TH`, `TD`, `EmptyRow`) ·
`stat.tsx` (`StatCard`, `StatGrid`) · `page.tsx` (`PageHeader`, `EmptyState`, `Alert`, `DetailList`) ·
`progress.tsx` (`ProgressBar`, `ProgressRing`) · `modal.tsx` (`Modal`, `ConfirmDialog`) · `tabs.tsx` (`Tabs`, `LinkTabs`) ·
`filters.tsx` (`SearchInput`, `FilterSelect`, `DateFilter`, `FilterBar`, `Pagination` — URL-driven, work with server pages) ·
`file-input.tsx` (`FileInput` with client-side type/size checks) · `charts.tsx` (`TrendChart`, `BarChartSimple`, `DonutChart`) ·
`avatar.tsx` (`Avatar`) · `toast.tsx` (`useToast`) · `cn.ts`. Brand: `components/brand.tsx` (`Logo`, `Wordmark`).

Portal chrome (`components/portal/shell.tsx`, nav in `components/portal/nav.ts`) is already wired in each portal `layout.tsx`.

### Design language

Modern, calm SaaS look: white cards (`Card`) on `bg-slate-50`, rounded-2xl, subtle borders, indigo brand, generous spacing,
clear hierarchy. Every page starts with `<PageHeader title description actions />`. Lists: `Card` > `FilterBar` > `Table` > `Pagination`.
Dashboards: `StatGrid` of `StatCard`s, then charts in cards. Always handle empty states (`EmptyState`) and loading/disabled
states on buttons. Must be responsive down to 360 px (tables scroll horizontally; forms stack). Use plain professional
English in admin/college/mentor UIs (no Hinglish — NFR-9/G-7), no `console.log` of API responses.

## Demo data & credentials (from `prisma/seed.ts`)

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin@12345` |
| College | `gvdc`, `mmc`, `mist`, `kcc` (`vwc` = pending college) | `College@123` |
| Mentor | `msym001` (WEB) … `msym008` (AGRI), `msym009` (WEB) | `Mentor@123` |
| Student (active) | `student.demo` (Ananya Sharma, WEB) | `Student@123` |
| Student (completed) | `student.done` (Rohit Kumar, WEB, certificate verify code `MSYDEMO2026`) | `Student@123` |

Other seeded students also use `Student@123`. Students with `nextStep = 1` (uploaded, not yet registered) can be used to test the registration wizard.

To call APIs from PowerShell for testing:
```powershell
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Uri http://localhost:3000/api/auth/login -Method Post -ContentType 'application/json' -Body '{"identifier":"admin","password":"Admin@12345"}' -WebSession $s
Invoke-WebRequest -Uri http://localhost:3000/admin -WebSession $s -UseBasicParsing | Select-Object StatusCode
```
