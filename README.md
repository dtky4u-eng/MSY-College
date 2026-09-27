# MSY College ERP

Web-based internship management system for the full **NEP 2020 / CBCS undergraduate internship lifecycle**: college-verified
student registration and online fee payment, then learning, attendance, logbook, submissions, mentor assessment, results and
QR-verified certificates, and finally college revenue settlement.

It is built from *MSY College ERP — Application Requirements Specification* (text copy in [`docs/SPEC.txt`](docs/SPEC.txt)).
Requirement IDs (FR-*, AR-*, WF-*, NFR-*, G-*) below refer to that document.

## Quick start

Requires Node.js 20+ (built and tested on Node 24 LTS, Windows).

```bash
npm install
npm run setup        # creates prisma/dev.db and loads the demo dataset
npm run dev          # http://localhost:3000
```

Production: `npm run build && npm run start`. To reset the demo data at any time: `npm run db:reset` (delete `storage/` too for a clean slate).

### Demo accounts

| Role | Username | Password | Notes |
|---|---|---|---|
| Admin | `admin` | `Admin@12345` | Full console |
| College | `gvdc` · `mmc` · `mist` · `kcc` | `College@123` | `vwc` belongs to a *pending* college |
| Mentor | `msym001` (Web Dev) … `msym008` (Agri-Business), `msym009` | `Mentor@123` | |
| Student | `student.demo` | `Student@123` | Ananya Sharma: active internship, mid-way |
| Student | `student.done` | `Student@123` | Rohit Kumar: completed, certificate issued |

- **Try registration** at `/register` with an uploaded but not-yet-registered student's university registration number, e.g. `24GVDCBBA0101`, `23MMCBA0102`, `23MISTBBA0103` or `23KCCBA0104`. With no gateway keys configured, payment uses the built-in **sandbox checkout**, which can simulate success, failure, pending and verification failure.
- **Verify a certificate** at `/verify/MSYDEMO2026`.
- **Password-reset emails** are written to `storage/outbox/`.

## What's included

| Area | Screens |
|---|---|
| Public | Landing page (live domains and fees, 8-step journey, NEP 2020 benefits, recognitions, contact), legal pages, certificate verification `/verify`, forgot/reset password |
| Registration | Bilingual (EN/HI) 6-step wizard: Verify → Details → Domain → Documents → Review & lock → Payment (Razorpay / Cashfree / sandbox), with success, pending, verify-failed and failed states |
| Student | Dashboard, Learning (sequential unlock, video/PDF/notes, heartbeat time tracking, quizzes), Attendance (check-in/out, calendar), Log Book, Assignments, Live Project, Internship Report, Routine, Download Center (7 PDFs + receipts), Profile, live-class popup, notifications. All in English and Hindi |
| College | Dashboard with revenue analytics, Excel student upload with row-level warnings, Registrations tracker, Students & Certificates (password reset), Payments & settlements, Profile |
| Mentor | Dashboard, Assigned Students (leave approval), Resources, Quizzes, Quiz Reattempts, Submission Reviews, Assessments |
| Admin | Dashboard + messaging, Students (import/edit/status/dates/mentor/password), Internships (single/bulk start, auto-assign mentors), Colleges + domain fees, Mentors + assignment, Learning Setup (+ Excel quiz import), Payments (reconcile/mark paid/edit/refund/receipts), College Settlements, Live Classes, Routines, Quiz Reattempts, Bulk Automation (async jobs, cancel/retry, ZIP), Reports (Excel/PDF), Audit Log, Settings |

## Architecture

- **Next.js 15 (App Router) + React 19 + TypeScript**, styled with **Tailwind CSS v4**; charts in Recharts; icons from Lucide.
- **Prisma + SQLite** by default. For PostgreSQL, change `provider` in `prisma/schema.prisma` and `DATABASE_URL`. All money is stored in paise.
- **Pages** are server components that read data after a role guard. Interactive parts call **REST endpoints** under
  `/api/{auth,register,payments,student,college,mentor,admin}/…`. Every endpoint re-checks role and data scope on the server (NFR-1).
- **Auth** (AR-1…AR-6): login by username, email or MSY College number. Access (30 min) + rotating refresh (7 days) tokens are held in
  httpOnly cookies and backed by a `Session` table, so logout and password changes revoke sessions. Expired sessions show
  "Restoring session…" (`/restore`). Unknown roles are rejected.
- **Payments** (WF-1, NFR-3): the server chooses the gateway (admin setting or `PAYMENT_GATEWAY`; `auto` = Razorpay if configured, else
  Cashfree, else sandbox). The account activates only after server-side signature, order-status or webhook verification, and
  activation is idempotent. No card data is stored.
  Webhooks: `POST /api/payments/webhook/razorpay` and `POST /api/payments/webhook/cashfree`.
- **Files** (NFR-6, NFR-11): stored in `storage/` outside `public/`. Real file types are checked from file contents, size limits apply,
  and every download goes through an access-checked route.
- **Documents** are PDFs rendered on demand from live data. Certificates carry a QR code pointing to `/verify/<code>` (NFR-10).
- **Bulk automation** jobs run asynchronously in-process with progress, cancel and retry (NFR-7).
- **Audit log** covers payments, student status, passwords, bulk jobs, settlements and settings (NFR-5).

Developer conventions and the shared-library map are in [`docs/DEV_GUIDE.md`](docs/DEV_GUIDE.md).

### Configuration (`.env`, see `.env.example`)

`DATABASE_URL`, `JWT_SECRET` and `SANDBOX_GATEWAY_SECRET` (**change both in production**), `APP_URL` (used in QR codes, emails and
gateway return URLs), `PAYMENT_GATEWAY`, `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `CASHFREE_APP_ID/SECRET_KEY/ENV`, `STORAGE_DIR`.

## How the spec's gaps and open questions were resolved

| Item | Resolution |
|---|---|
| G-1 unlinked footer links | All footer links work (Track Application → `/register`, College Login / Upload Students → `/login`, Register College → partner section, Resources → domains) |
| G-2 static sample data | College registrations, mentor reviews and assessments are bound to live data |
| G-3 no verification page | Public `/verify` and `/verify/<code>` (also accepts the certificate number), minimal personal data |
| G-4 hard-coded session/semester | Sessions, semesters and programmes are admin-managed master data (Settings) |
| G-5 photo URL field | Real image upload (JPG/PNG/WEBP ≤ 2 MB) |
| G-6 YouTube tracking | Watch time counts while the video panel is open and the page is visible; uploaded MP4s count only while playing |
| G-7 / NFR-9 Hinglish, console logs | Professional English copy; no API-response logging |
| G-8 marketing mock menu | Landing-page mock mirrors the real student menu |
| G-9 bulk-generated records | Every generated record is flagged `generated`. Data-generating jobs require a reason and typing `GENERATE`, are audited, and are labelled in reports |
| Primary gateway | Configurable (Settings → Payments), with the `auto` rule above |
| Refund flow | Admin "Record refund" (record-only; money is returned in the gateway dashboard). It marks the payment REFUNDED, the student unpaid, and deactivates the account |
| Certificate eligibility | Configurable rules (Settings). Defaults: attendance ≥ 75 %, logbook hours ≥ 100 % of domain hours, quiz average ≥ 50 %, all chapters complete, project and report approved, mentor recommendation |
| College self-registration | Admin-only onboarding (as observed); the landing page has a partner-enquiry section |
| Mentor attendance/leave | Mentors can mark and revoke Approved Leave for assigned students (audited) |
| ID-document retention | Documented in the Privacy Policy; access is limited to the student, their college, assigned mentor and admin |

### Other decisions

- **Resuming registration:** resuming a registration that already has login credentials asks for the password, not just the registration number (security hardening).
- **Mark Paid:** allowed for CREATED payments as the spec says, and also for PENDING and VERIFY_FAILED payments to support WF-1 reconciliation. It needs a reason of at least 10 characters.
- **Result score:** 40 % quiz average + 40 % mentor assessment + 20 % attendance. Grades: O ≥ 90, A+ ≥ 80, A ≥ 70, B+ ≥ 60, B ≥ 50, C ≥ 40.
- **Excel formats:** only `.xlsx` files can be read. Legacy `.xls` uploads get a clear message asking the user to re-save as `.xlsx`.
- **Email:** no SMTP integration is included. Emails are written to `storage/outbox`; plug a mailer into `src/lib/mail.ts` for production.

## Verification performed

- `tsc --noEmit` and `next build` pass with zero errors.
- An integration run against the production build covered every page for all roles (HTTP 200, no runtime errors) and cross-role access denial.
- It also covered mentor reviews, assessments, leave, reattempts, resources and quizzes; admin student edits, password reset and bulk internship start with auto-assign; and the scheduled-student view.
- The build agents also tested the registration and payment paths (success, pending, verify-failed, failed), the student flows, college/mentor data-scope isolation, and the admin payment, settlement, bulk and report operations.
- Every page was checked for horizontal overflow at phone width (390 px).
