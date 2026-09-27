import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileCheck2,
  GraduationCap,
  Handshake,
  Layers,
  Mail,
  MonitorPlay,
  Phone,
  QrCode,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/format";
import { ORG } from "@/lib/constants";
import { PublicShell, MAILTO, TEL } from "@/components/public/site";
import { DashboardMock } from "@/components/public/dashboard-mock";

export const revalidate = 300;

const STEPS = [
  { t: "Registration", d: "Verify your university registration number and create your login.", i: UserPlus },
  { t: "Document Verification", d: "Upload your passport photo and latest semester admit card.", i: FileCheck2 },
  { t: "Domain Selection", d: "Choose any domain — every stream is eligible for every domain.", i: Layers },
  { t: "Mentor Allocation", d: "A domain expert is assigned to guide and review your work.", i: UserCheck },
  { t: "Training & Live Projects", d: "Sequential learning modules, quizzes, live classes and a real project.", i: MonitorPlay },
  { t: "Attendance & Logbook", d: "Daily check-in / check-out and a digital logbook of hours and skills.", i: CalendarCheck },
  { t: "Report & Evaluation", d: "Submit your internship report; your mentor assesses your performance.", i: ClipboardCheck },
  { t: "Certificate", d: "Download your QR-verified certificate and assessment marksheet.", i: Award },
];

const WHY = [
  { t: "College-verified registration", d: "Only students uploaded by their own college can register — no fake enrolments.", i: ShieldCheck },
  { t: "Structured learning path", d: "Modules and chapters unlock in sequence with minimum watch and reading time.", i: BookOpenCheck },
  { t: "Real mentors", d: "Every student gets a domain mentor who reviews submissions and assesses skills.", i: Users },
  { t: "Complete documentation", d: "Offer letter, attendance sheet, logbook, report, marksheet and certificate.", i: ScrollText },
  { t: "QR-verified certificates", d: "Anyone can verify a certificate instantly by scanning its QR code.", i: QrCode },
  { t: "Transparent for colleges", d: "Colleges track registrations, progress, payments and settlements live.", i: Building2 },
];

async function topDomains() {
  try {
    return await prisma.domain.findMany({
      where: { active: true },
      include: { sector: true },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      take: 12,
    });
  } catch {
    return [];
  }
}

function SectionHead({ eyebrow, title, desc, center }: { eyebrow: string; title: string; desc?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {desc && <p className="mt-4 text-base leading-relaxed text-slate-600">{desc}</p>}
    </div>
  );
}

export default async function HomePage() {
  const domains = await topDomains();

  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/70 via-white to-white">
        <div className="bg-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pb-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100">
              <Sparkles className="size-3.5 text-accent-500" /> NEP 2020 · 4-year CBCS UG programmes
            </span>
            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Your mandatory <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">NEP 2020 internship</span>, done right.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Earn your 4 internship credits with a structured ~120-hour programme — mentor-guided learning, live projects, digital attendance and logbook, and a
              QR-verified certificate your university can trust.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-base font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700"
              >
                Apply for Internship <ArrowRight className="size-4" />
              </Link>
              <a
                href="#domains"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-800 hover:bg-slate-50"
              >
                Explore Domains
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              {["4 academic credits", "~120 hours", "Certificate included"].map((x) => (
                <li key={x} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500" /> {x}
                </li>
              ))}
            </ul>
          </div>
          <DashboardMock />
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-200 bg-white">
        <dl className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-slate-100 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
          {[
            ["10,000+", "Students trained"],
            ["200+", "Partner colleges"],
            ["50+", "Internship domains"],
          ].map(([v, k]) => (
            <div key={k} className="flex flex-col-reverse py-7 text-center">
              <dt className="text-sm text-slate-500">{k}</dt>
              <dd className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <SectionHead
            eyebrow="About MSY College"
            title="One system for the complete internship lifecycle"
            desc={`${ORG.name} partners with colleges to deliver the undergraduate internship required under NEP 2020 and CBCS — from college-verified registration and online fee payment to learning, attendance, assessment and QR-verified certificates.`}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { t: "MSME Registered", d: "Registered micro, small & medium enterprise under the Government of India.", i: BadgeCheck },
              { t: "MCA Incorporated", d: "Private limited company incorporated with the Ministry of Corporate Affairs.", i: Building2 },
              { t: "Built for colleges", d: "Colleges upload students, track progress and download certificates.", i: GraduationCap },
              { t: "Built for students", d: "Bilingual (English / Hindi), mobile-first and simple to use.", i: Users },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <c.i className="size-6 text-brand-600" />
                <p className="mt-3 font-semibold text-slate-900">{c.t}</p>
                <p className="mt-1 text-sm text-slate-600">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Domains */}
      <section id="domains" className="scroll-mt-20 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHead eyebrow="Top domains" title="Choose from in-demand internship domains" desc="Students of any stream can choose any domain. Every domain includes mentor support, a live project and a certificate." />
            <Link href="/register" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800">
              Start registration <ArrowRight className="size-4" />
            </Link>
          </div>
          {domains.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              Domain details will be published shortly. Please check back soon or contact the helpdesk.
            </div>
          ) : (
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {domains.map((d) => (
                <li key={d.id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop">
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{d.sector.name}</span>
                    {d.featured && <Sparkles className="size-4 text-accent-500" aria-label="Featured" />}
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">{d.name}</h3>
                  {d.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{d.description}</p>}
                  <div className="mt-auto space-y-1.5 pt-4 text-sm text-slate-600">
                    <p className="flex items-center gap-1.5">
                      <Clock className="size-4 text-slate-400" /> {d.durationHours} hours
                    </p>
                    <p className="flex items-center gap-1.5 text-emerald-700">
                      <Award className="size-4" /> Certificate included
                    </p>
                  </div>
                  <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs text-slate-500">Starting from</span>
                    <span className="text-lg font-extrabold text-slate-900">{formatINR(d.defaultFee)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-slate-500">Fees may vary by college. The exact fee for your college is shown during registration.</p>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead center eyebrow="How it works" title="Your 8-step internship journey" desc="A clear, guided path from registration to certificate — tracked at every step." />
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
                    <s.i className="size-5" />
                  </span>
                  <span className="font-display text-3xl font-extrabold text-slate-100">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.t}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* NEP 2020 */}
      <section id="nep" className="relative scroll-mt-20 overflow-hidden bg-brand-950 py-20 text-white sm:py-24">
        <div className="bg-grid absolute inset-0 opacity-30" />
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-semibold tracking-wide text-accent-400 uppercase">NEP 2020 &amp; CBCS</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Why the internship matters for your degree</h2>
            <p className="mt-4 text-brand-100">
              Under the National Education Policy 2020, 4-year undergraduate programmes include a mandatory internship. MSY College delivers it in a format your college
              and university can verify.
            </p>
            <Link href="/register" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-semibold text-brand-800 hover:bg-brand-50">
              Apply for Internship <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { v: "Mandatory", d: "Required for 4-year CBCS undergraduate programmes." },
              { v: "4 Credits", d: "Counts towards your academic credits on completion." },
              { v: "~120 Hours", d: "Learning, live project, attendance and logbook hours." },
              { v: "Report & Certificate", d: "Internship report, marksheet and QR-verified certificate." },
            ].map((c) => (
              <div key={c.v} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur">
                <p className="font-display text-2xl font-extrabold text-white">{c.v}</p>
                <p className="mt-1 text-sm text-brand-200">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead center eyebrow="Why MSY College" title="Designed for students, trusted by colleges" />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((w) => (
              <div key={w.t} className="flex gap-4 rounded-2xl border border-slate-200 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <w.i className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{w.t}</h3>
                  <p className="mt-1 text-sm text-slate-600">{w.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recognitions */}
      <section className="border-y border-slate-200 bg-slate-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-semibold tracking-wide text-slate-500 uppercase">Recognitions &amp; compliance</p>
          <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["MSME", "Registered enterprise"],
              ["MCA", "Incorporated company"],
              ["AICTE", "Aligned with AICTE guidelines"],
              ["ISO 9001:2015", "Quality management"],
            ].map(([k, v]) => (
              <li key={k} className="flex flex-col items-center rounded-2xl bg-white p-5 text-center ring-1 ring-slate-200">
                <BadgeCheck className="size-7 text-emerald-600" />
                <p className="mt-2 font-display text-lg font-extrabold text-slate-900">{k}</p>
                <p className="text-xs text-slate-500">{v}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Colleges */}
      <section id="partner" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-violet-700 p-8 text-white sm:p-12 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-100">
                <Handshake className="size-4" /> For colleges
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Partner with MSY College</h2>
              <p className="mt-4 text-brand-100">
                Colleges are onboarded by the MSY College team. Once onboarded, your college gets its own portal to upload the student database, track registrations and
                progress, view revenue share and settlements, and download certificates.
              </p>
              <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
                {["Excel upload of student records", "Live registration & payment tracking", "Configurable revenue share", "Certificates for every student"].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-accent-400" /> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-6 text-slate-900 shadow-pop">
              <p className="font-semibold">Onboard your college</p>
              <p className="mt-1 text-sm text-slate-600">Talk to our partnerships team — we&apos;ll set up your college portal and fees.</p>
              <div className="mt-5 space-y-3">
                <a
                  href={`${MAILTO}?subject=${encodeURIComponent("College partnership enquiry")}`}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <Mail className="size-4" /> Email partnerships
                </a>
                <a href={TEL} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50">
                  <Phone className="size-4" /> Call {ORG.phone}
                </a>
                <Link href="/login" className="block text-center text-sm font-semibold text-brand-700 hover:text-brand-800">
                  Already onboarded? College login →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 bg-slate-50 pt-4 pb-20 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
          <SectionHead center eyebrow="Contact" title="We're here to help" desc="Questions about registration, payments or certificates? Reach our helpdesk." />
          <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
            <a href={TEL} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card hover:border-brand-300">
              <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Phone className="size-5" />
              </span>
              <span>
                <span className="block text-xs text-slate-500">Call us</span>
                <span className="block text-lg font-semibold text-slate-900">{ORG.phone}</span>
              </span>
            </a>
            <a href={MAILTO} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card hover:border-brand-300">
              <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Mail className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-slate-500">Email us</span>
                <span className="block truncate text-lg font-semibold text-slate-900">{ORG.email}</span>
              </span>
            </a>
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            Have a certificate to check?{" "}
            <Link href="/verify" className="font-semibold text-brand-700 hover:text-brand-800">
              Verify it here
            </Link>
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
