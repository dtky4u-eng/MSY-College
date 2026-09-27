/* eslint-disable no-console */
// Demo dataset covering every lifecycle state. Run with `npm run db:seed` (or `npm run db:reset`).
// Demo credentials are listed in README.md.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DOMAINS, WEB_QUESTIONS } from "./seed-content";

const prisma = new PrismaClient();

// ── deterministic helpers ──
let seed = 20260926;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const shuffle = <T,>(arr: T[]) => arr.map((v) => [rand(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

const TZ = "Asia/Kolkata";
function ymd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
const istMidnight = (s: string) => new Date(s + "T00:00:00+05:30");
const daysAgo = (n: number) => {
  const d = istMidnight(ymd(new Date()));
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};
const addDaysD = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
function workingDays(from: Date, to: Date) {
  const out: string[] = [];
  let cur = istMidnight(ymd(from));
  const end = ymd(to);
  while (ymd(cur) <= end) {
    const s = ymd(cur);
    if (new Date(s + "T12:00:00+05:30").getUTCDay() !== 0) out.push(s);
    cur = addDaysD(cur, 1);
  }
  return out;
}
const at = (day: string, hh: number, mm: number) => new Date(`${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`);

const STORAGE = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage");

async function saveFile(bytes: Uint8Array, name: string, mime: string, purpose: string, extra: { studentId?: string; ownerUserId?: string } = {}) {
  const rel = path.join("seed", `${crypto.randomUUID()}${path.extname(name)}`);
  fs.mkdirSync(path.join(STORAGE, "seed"), { recursive: true });
  fs.writeFileSync(path.join(STORAGE, rel), bytes);
  return prisma.fileObject.create({ data: { originalName: name, mime, size: bytes.length, path: rel.replace(/\\/g, "/"), purpose, ...extra } });
}

async function simplePdf(title: string, lines: string[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: rgb(0.263, 0.22, 0.792) });
  page.drawText("MSY College", { x: 40, y: 806, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText(title, { x: 40, y: 740, size: 16, font: bold });
  let y = 710;
  for (const l of lines) {
    page.drawText(l, { x: 40, y, size: 11, font });
    y -= 18;
  }
  return doc.save();
}

// Tiny valid PNG (1×1 indigo pixel) for demo photos.
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkaPj/HwAFhAJ/wlseKgAAAABJRU5ErkJggg==", "base64");

const FIRST_M = ["Aarav", "Vivek", "Rohit", "Aditya", "Sachin", "Manish", "Rahul", "Ankit", "Saurabh", "Prince", "Abhishek", "Nitish", "Shubham", "Aman", "Ravi", "Kunal", "Harsh", "Deepak"];
const FIRST_F = ["Ananya", "Priya", "Sneha", "Pooja", "Kajal", "Nisha", "Riya", "Anjali", "Shreya", "Khushi", "Neha", "Muskan", "Sakshi", "Aditi", "Tanya", "Payal"];
const LAST = ["Kumar", "Singh", "Sharma", "Kumari", "Verma", "Gupta", "Prasad", "Mishra", "Jha", "Yadav", "Raj", "Sinha", "Pandey", "Chaudhary", "Thakur", "Das"];
const FATHER = ["Ramesh", "Suresh", "Rajesh", "Mahesh", "Dinesh", "Ashok", "Anil", "Sunil", "Vinod", "Manoj", "Sanjay", "Arun"];
const PROGRAMMES = ["BA", "BSc", "BCom", "BCA", "BBA"];
const MAJORS: Record<string, string[]> = {
  BA: ["Economics", "Political Science", "History", "English", "Psychology"],
  BSc: ["Physics", "Chemistry", "Mathematics", "Botany", "Zoology"],
  BCom: ["Accountancy", "Commerce"],
  BCA: ["Computer Applications"],
  BBA: ["Business Administration"],
};
const SKILLS = ["problem solving", "documentation", "teamwork", "research", "presentation", "time management", "tool usage", "data handling", "communication"];
const ACTIVITIES = [
  "Completed the chapter lecture and took notes on key concepts",
  "Practised exercises from today's module and discussed doubts with mentor",
  "Worked on the live project — planned tasks and drafted the outline",
  "Attended the live class and summarised the session",
  "Researched real-world examples related to the current module",
  "Reviewed feedback and improved the assignment draft",
  "Prepared the project report section and collected references",
];

async function main() {
  console.log("Seeding MSY College demo data…");
  fs.rmSync(path.join(STORAGE, "seed"), { recursive: true, force: true });

  // ── clean (respect FK order) ──
  const tables = [
    "auditLog", "notification", "liveClassAttendance", "liveClass", "routine", "bulkJob", "collegeSettlement", "payment", "certificate", "assessment",
    "submission", "assignment", "logbookEntry", "attendance", "chapterProgress", "quizReattemptGrant", "quizAttempt", "question", "quiz", "resource",
    "chapter", "module", "studentImport", "student", "mentor", "collegeDomainFee", "college", "domain", "sector", "masterOption", "fileObject",
    "passwordReset", "session", "user", "setting",
  ] as const;
  for (const t of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any)[t].deleteMany();
  }

  const hash = (p: string) => bcrypt.hashSync(p, 10);
  const pw = { admin: hash("Admin@12345"), college: hash("College@123"), mentor: hash("Mentor@123"), student: hash("Student@123") };

  // ── settings & master data ──
  await prisma.setting.createMany({
    data: [
      { key: "eligibility", value: JSON.stringify({ minAttendancePercent: 75, minHoursPercent: 100, minQuizAverage: 50, requireAllChapters: true, requireProjectApproved: true, requireReportApproved: true, requireMentorRecommendation: true }) },
      { key: "internship", value: JSON.stringify({ defaultWeeks: 6, checkInFrom: "06:00", halfDayBelowHours: 4 }) },
      { key: "payments", value: JSON.stringify({ gateway: "auto" }) },
    ],
  });
  const opts: { type: string; value: string; label: string; sort: number; active: boolean }[] = [];
  ["2022-26", "2023-27", "2024-28", "2025-29"].forEach((v, i) => opts.push({ type: "SESSION", value: v, label: v, sort: i, active: v !== "2022-26" }));
  ["3", "4", "5", "6", "7"].forEach((v, i) => opts.push({ type: "SEMESTER", value: v, label: `Semester ${v}`, sort: i, active: v === "4" || v === "5" }));
  ["BA", "BSc", "BCom", "BCA", "BBA", "BSc (IT)", "BVoc"].forEach((v, i) => opts.push({ type: "PROGRAMME", value: v, label: v, sort: i, active: true }));
  await prisma.masterOption.createMany({ data: opts });

  // ── admin ──
  const admin = await prisma.user.create({ data: { username: "admin", email: "admin@msycollege.org", passwordHash: pw.admin, role: "ADMIN" } });

  // ── sectors, domains, content ──
  const sectorIds = new Map<string, string>();
  for (const name of [...new Set(DOMAINS.map((d) => d.sector))]) sectorIds.set(name, (await prisma.sector.create({ data: { name } })).id);

  const domainIds = new Map<string, string>();
  const chapterOrder = new Map<string, { id: string; quizId: string | null; questionIds: string[]; maxScore: number }[]>();
  for (const d of DOMAINS) {
    const domain = await prisma.domain.create({
      data: { code: d.code, name: d.name, description: d.description, sectorId: sectorIds.get(d.sector)!, durationHours: 120, defaultFee: d.fee * 100, featured: d.featured },
    });
    domainIds.set(d.code, domain.id);
    const order: { id: string; quizId: string | null; questionIds: string[]; maxScore: number }[] = [];
    for (const [mi, m] of d.modules.entries()) {
      const mod = await prisma.module.create({ data: { domainId: domain.id, number: mi + 1, name: m.name, description: `Module ${mi + 1} of ${d.name}: ${m.chapters.map((c) => c.name).join(", ")}.` } });
      for (const [ci, c] of m.chapters.entries()) {
        const ch = await prisma.chapter.create({
          data: { moduleId: mod.id, number: ci + 1, name: c.name, description: c.summary + ".", minWatchSeconds: 60, minReadSeconds: 45 },
        });
        await prisma.resource.createMany({
          data: [
            { chapterId: ch.id, title: `${c.name} — recorded lecture`, type: "VIDEO", url: "https://www.youtube.com/embed/ysEN5RaKOlA", sortOrder: 1, primary: true, downloadable: false },
            {
              chapterId: ch.id,
              title: `${c.name} — study notes`,
              type: "NOTES",
              sortOrder: 2,
              content: `## ${c.name}\n\n${c.summary}.\n\n### Key ideas\n- Understand why *${c.name.toLowerCase()}* matters in ${d.name.toLowerCase()}.\n- Relate the concept to a real organisation or project you know.\n- Note one question to discuss with your mentor.\n\n### Practice\n1. Write a 5-line summary of this chapter in your logbook.\n2. Find one real-world example and describe it.\n3. List two skills you practised today.`,
            },
            { chapterId: ch.id, title: "Further reading", type: "LINK", url: "https://en.wikipedia.org/wiki/Special:Search?search=" + encodeURIComponent(c.name), sortOrder: 3 },
          ],
        });
        // quiz
        const bank = d.code === "WEB" ? WEB_QUESTIONS[c.name] : undefined;
        const others = shuffle(d.modules.flatMap((mm) => mm.chapters).filter((x) => x.name !== c.name)).slice(0, 3);
        const generated = [
          { q: `Which statement best describes “${c.name}”?`, options: shuffle([c.summary, ...others.map((o) => o.summary)]), correctText: c.summary, explanation: `${c.name}: ${c.summary}.` },
          { q: `“${c.name}” is part of which module?`, options: shuffle([m.name, ...d.modules.filter((mm) => mm.name !== m.name).map((mm) => mm.name)]), correctText: m.name, explanation: `It is covered in Module ${mi + 1}: ${m.name}.` },
          { q: `Which chapter comes right after “${c.name}” in your learning path?`, options: [] as string[], correctText: "", explanation: "" },
        ];
        const flat = d.modules.flatMap((mm) => mm.chapters.map((x) => x.name));
        const idx = flat.indexOf(c.name);
        const nextName = flat[idx + 1];
        if (nextName) {
          generated[2] = { q: `Which chapter comes right after “${c.name}” in your learning path?`, options: shuffle([nextName, ...shuffle(flat.filter((x) => x !== nextName && x !== c.name)).slice(0, 3)]), correctText: nextName, explanation: `The next chapter is “${nextName}”.` };
        } else generated.pop();
        const questions = bank
          ? bank.map((b, i) => ({ text: b.q, options: b.options, correctIndex: b.correct, explanation: b.explanation, sort: i }))
          : generated.map((g, i) => ({ text: g.q, options: g.options, correctIndex: g.options.indexOf(g.correctText), explanation: g.explanation, sort: i }));
        const quiz = await prisma.quiz.create({
          data: {
            chapterId: ch.id,
            title: `${c.name} — chapter quiz`,
            description: "Answer all questions. You need the passing score to complete this chapter.",
            passingScore: 60,
            attemptsAllowed: 3,
            timeLimitMinutes: ci === 2 ? 10 : null,
            randomize: true,
            showResult: true,
            createdById: admin.id,
          },
        });
        const qIds: string[] = [];
        for (const q of questions) {
          const row = await prisma.question.create({ data: { quizId: quiz.id, text: q.text, options: JSON.stringify(q.options), correctIndex: q.correctIndex, marks: 1, explanation: q.explanation, sort: q.sort } });
          qIds.push(row.id);
        }
        order.push({ id: ch.id, quizId: quiz.id, questionIds: qIds, maxScore: qIds.length });
      }
    }
    chapterOrder.set(d.code, order);

    // assignments
    const briefBytes = await simplePdf(`${d.name} — Assignment Brief`, ["Read the problem statement and submit a PDF, DOCX, PPTX or ZIP (max 10 MB).", "Evaluation: clarity, correctness, originality and presentation."]);
    const brief = await saveFile(briefBytes, `${d.code}_assignment_brief.pdf`, "application/pdf", "ASSIGNMENT_BRIEF");
    await prisma.assignment.createMany({
      data: [
        { domainId: domain.id, title: `${d.modules[0]!.name}: case study`, description: `Write a 2–3 page case study applying concepts from “${d.modules[0]!.name}” to a real organisation.`, dueDate: daysAgo(-10), maxMarks: 50, briefFileId: brief.id, createdById: admin.id },
        { domainId: domain.id, title: `${d.modules[2]!.name}: practical task`, description: `Complete the practical exercise for “${d.modules[2]!.name}” and upload your work with a short explanation.`, dueDate: daysAgo(-24), maxMarks: 100, briefFileId: brief.id, createdById: admin.id },
      ],
    });
  }

  // ── colleges ──
  const COLLEGES = [
    { code: "GVDC", name: "Ganga Valley Degree College", university: "Ganga Valley University", district: "Patna", principal: "Dr. Alok Ranjan", coordinator: "Prof. Meena Kumari", share: 20, status: "ACTIVE" },
    { code: "MMC", name: "Magadh Mahila College of Arts & Science", university: "Ganga Valley University", district: "Gaya", principal: "Dr. Sunita Prasad", coordinator: "Dr. Kavita Sinha", share: 25, status: "ACTIVE" },
    { code: "MIST", name: "Mithila Institute of Science & Technology", university: "Mithila State University", district: "Darbhanga", principal: "Dr. R. N. Jha", coordinator: "Prof. Ajay Mishra", share: 20, status: "ACTIVE" },
    { code: "KCC", name: "Kosi Commerce College", university: "Mithila State University", district: "Saharsa", principal: "Dr. P. K. Yadav", coordinator: "Prof. Rekha Devi", share: 15, status: "ACTIVE" },
    { code: "VWC", name: "Vaishali Women's College", university: "Ganga Valley University", district: "Hajipur", principal: "Dr. Nandini Verma", coordinator: "Prof. Shalini Raj", share: 20, status: "PENDING" },
  ];
  const colleges: { id: string; code: string; adminUserId: string; share: number }[] = [];
  for (const [i, c] of COLLEGES.entries()) {
    const u = await prisma.user.create({ data: { username: c.code.toLowerCase(), email: `${c.code.toLowerCase()}@college.example.in`, passwordHash: pw.college, role: "COLLEGE" } });
    const col = await prisma.college.create({
      data: {
        name: c.name,
        code: c.code,
        university: c.university,
        principal: c.principal,
        coordinator: c.coordinator,
        email: `principal.${c.code.toLowerCase()}@college.example.in`,
        mobile: `94310${String(10000 + i * 1111).slice(0, 5)}`,
        state: "Bihar",
        district: c.district,
        pincode: ["800001", "823001", "846004", "852201", "844101"][i],
        address: `College Road, ${c.district}, Bihar`,
        collegeShare: c.share,
        rknexoraShare: 100 - c.share,
        status: c.status,
        adminUserId: u.id,
      },
    });
    colleges.push({ id: col.id, code: c.code, adminUserId: u.id, share: c.share });
  }
  // custom fees
  await prisma.collegeDomainFee.createMany({
    data: [
      { collegeId: colleges[0]!.id, domainId: domainIds.get("WEB")!, fee: 1799_00 },
      { collegeId: colleges[0]!.id, domainId: domainIds.get("DA")!, fee: 1599_00 },
      { collegeId: colleges[1]!.id, domainId: domainIds.get("DM")!, fee: 1299_00 },
      { collegeId: colleges[3]!.id, domainId: domainIds.get("BM")!, fee: 1199_00 },
    ],
  });
  const feeFor = async (collegeId: string, code: string) => {
    const f = await prisma.collegeDomainFee.findUnique({ where: { collegeId_domainId: { collegeId, domainId: domainIds.get(code)! } } });
    return f?.fee ?? DOMAINS.find((d) => d.code === code)!.fee * 100;
  };

  // ── mentors ──
  const MENTOR_NAMES = ["Rakesh Ranjan", "Dr. Pallavi Singh", "Amit Kumar Jha", "Sonal Mehta", "Vikas Anand", "Ritu Sharma", "Kaushal Kishore", "Dr. Manoj Tiwari"];
  const mentors = new Map<string, { id: string; userId: string }>();
  for (const [i, d] of DOMAINS.entries()) {
    const emp = `MSYM${String(i + 1).padStart(3, "0")}`;
    const u = await prisma.user.create({ data: { username: emp.toLowerCase(), email: `${emp.toLowerCase()}@msycollege.org`, passwordHash: pw.mentor, role: "MENTOR" } });
    const m = await prisma.mentor.create({
      data: { userId: u.id, name: MENTOR_NAMES[i]!, employeeId: emp, mobile: `98350${String(20000 + i * 37).slice(0, 5)}`, email: `${emp.toLowerCase()}@msycollege.org`, domainId: domainIds.get(d.code)!, designation: "Senior Mentor" },
    });
    mentors.set(d.code, { id: m.id, userId: u.id });
  }
  // second WEB mentor tied to a college
  {
    const u = await prisma.user.create({ data: { username: "msym009", email: "msym009@msycollege.org", passwordHash: pw.mentor, role: "MENTOR" } });
    await prisma.mentor.create({ data: { userId: u.id, name: "Neha Bharti", employeeId: "MSYM009", mobile: "9835099009", email: "msym009@msycollege.org", domainId: domainIds.get("WEB")!, collegeId: colleges[0]!.id, designation: "Mentor" } });
  }

  // ── students ──
  type Plan = "UPLOADED" | "PARTIAL" | "LOCKED_UNPAID" | "PAID_WAITING" | "NOT_STARTED" | "ACTIVE" | "COMPLETED" | "BLOCKED";
  const plans: Plan[] = [
    ...Array(16).fill("UPLOADED"),
    ...Array(4).fill("PARTIAL"),
    ...Array(4).fill("LOCKED_UNPAID"),
    ...Array(9).fill("PAID_WAITING"),
    ...Array(5).fill("NOT_STARTED"),
    ...Array(18).fill("ACTIVE"),
    ...Array(6).fill("COMPLETED"),
    ...Array(2).fill("BLOCKED"),
  ];
  const domainCodes = DOMAINS.map((d) => d.code);
  let studentSeq = 0;
  let portalSeq = 0;
  let receiptSeq = 0;
  let certSeq = 0;
  const yy = String(new Date().getFullYear()).slice(2);
  const today = ymd(new Date());
  const notes: { userId: string; title: string; body: string; kind: string; link?: string; createdAt?: Date }[] = [];

  for (const [i, plan] of plans.entries()) {
    const college = i % 9 === 8 ? colleges[4]! : colleges[i % 4]!;
    const female = rand() < 0.48;
    const first = female ? pick(FIRST_F) : pick(FIRST_M);
    let name = `${first} ${female && rand() < 0.4 ? "Kumari" : pick(LAST.filter((l) => l !== "Kumari"))}`;
    const programme = pick(PROGRAMMES);
    const session = pick(["2023-27", "2024-28"]);
    const regNo = `${session.slice(2, 4)}${college.code}${programme.replace(/\W/g, "").toUpperCase()}${String(101 + i).padStart(4, "0")}`;
    const code = pick(domainCodes);
    const isDemo = plan === "ACTIVE" && !plans.slice(0, i).includes("ACTIVE") ? "active" : plan === "COMPLETED" && !plans.slice(0, i).includes("COMPLETED") ? "done" : null;
    if (isDemo === "active") name = "Ananya Sharma";
    if (isDemo === "done") name = "Rohit Kumar";
    const demoCode = isDemo ? "WEB" : code;
    const domainCode = plan === "UPLOADED" || (plan === "PARTIAL" && i % 2 === 0) ? null : demoCode;
    const mobile = `9${int(100000000, 999999999)}`;
    const email = `${first.toLowerCase()}.${regNo.toLowerCase()}@student.example.in`;
    const base = {
      studentCode: `STU-${String(++studentSeq).padStart(6, "0")}`,
      collegeId: college.id,
      registrationNumber: regNo,
      rollNumber: String(100 + i),
      name,
      fatherName: `${pick(FATHER)} ${name.split(" ")[1] === "Kumari" ? pick(["Prasad", "Singh", "Kumar"]) : name.split(" ")[1]}`,
      gender: female && !["Aarav", "Rohit"].includes(first) ? "FEMALE" : "MALE",
      dob: istMidnight(`${int(2003, 2006)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`),
      programme,
      majorSubject: pick(MAJORS[programme]!),
      session,
      semester: session === "2023-27" ? "5" : "4",
      mobile: plan === "UPLOADED" && i % 3 === 0 ? null : mobile,
      email: plan === "UPLOADED" ? null : email,
    };
    if (isDemo) {
      base.gender = isDemo === "active" ? "FEMALE" : "MALE";
      base.fatherName = isDemo === "active" ? "Rajesh Sharma" : "Suresh Prasad";
    }

    if (plan === "UPLOADED") {
      await prisma.student.create({ data: { ...base, createdAt: daysAgo(int(5, 60)) } });
      continue;
    }

    const username = isDemo === "active" ? "student.demo" : isDemo === "done" ? "student.done" : `${first.toLowerCase()}${regNo.slice(-4)}`;
    const active = !["PARTIAL", "LOCKED_UNPAID"].includes(plan);
    const user = await prisma.user.create({ data: { username, email, passwordHash: pw.student, role: "STUDENT", active } });

    const photo = await saveFile(PNG_1PX, "photo.png", "image/png", "PHOTO", { ownerUserId: user.id });
    const admit = await saveFile(await simplePdf("Admit Card (demo)", [`Name: ${name}`, `Registration No: ${regNo}`, `Programme: ${programme}`]), "admit_card.pdf", "application/pdf", "ADMIT_CARD", { ownerUserId: user.id });
    const fee = domainCode ? await feeFor(college.id, domainCode) : null;

    const regMonthsAgo = plan === "ACTIVE" || plan === "COMPLETED" ? int(1, 11) : int(0, 2);
    const registeredAt = daysAgo(regMonthsAgo * 30 + int(0, 25));

    let status = "PENDING";
    let paymentStatus = "UNPAID";
    let nextStep = plan === "PARTIAL" ? (domainCode ? int(4, 5) : 3) : 6;
    let locked = plan !== "PARTIAL";
    let start: Date | null = null;
    let end: Date | null = null;
    let mentor: { id: string; userId: string } | null = null;

    if (["PAID_WAITING", "NOT_STARTED", "ACTIVE", "COMPLETED", "BLOCKED"].includes(plan)) {
      paymentStatus = "PAID";
      nextStep = 7;
      locked = true;
    }
    if (plan === "PAID_WAITING" && i % 3 !== 0) mentor = mentors.get(domainCode!)!;
    if (plan === "NOT_STARTED") {
      start = daysAgo(-int(3, 12));
      end = addDaysD(start, 41);
      mentor = mentors.get(domainCode!)!;
    }
    if (plan === "ACTIVE") {
      status = "ACTIVE";
      start = daysAgo(isDemo ? 30 : int(12, 40));
      end = addDaysD(start, 41);
      mentor = mentors.get(domainCode!)!;
    }
    if (plan === "COMPLETED") {
      status = "COMPLETED";
      start = daysAgo(int(70, 120));
      end = addDaysD(start, 41);
      mentor = mentors.get(domainCode!)!;
    }
    if (plan === "BLOCKED") {
      status = "BLOCKED";
      start = daysAgo(20);
      end = addDaysD(start, 41);
      mentor = mentors.get(domainCode!)!;
    }

    const student = await prisma.student.create({
      data: {
        ...base,
        userId: user.id,
        photoFileId: photo.id,
        admitCardFileId: nextStep >= 5 ? admit.id : null,
        domainId: domainCode ? domainIds.get(domainCode)! : null,
        feeAmount: fee,
        nextStep,
        registrationLocked: locked,
        lockedAt: locked ? registeredAt : null,
        registeredAt: paymentStatus === "PAID" ? registeredAt : null,
        portalRegNo: paymentStatus === "PAID" ? `MSY${yy}${String(++portalSeq).padStart(6, "0")}` : null,
        status,
        paymentStatus,
        internshipStart: start,
        internshipEnd: end,
        mentorId: mentor?.id ?? null,
        mentorAssignedAt: mentor ? registeredAt : null,
        blockedReason: plan === "BLOCKED" ? "Submitted a forged admit card — under verification" : null,
        createdAt: addDaysD(registeredAt, -int(3, 20)),
      },
    });
    await prisma.fileObject.updateMany({ where: { id: { in: [photo.id, admit.id] } }, data: { studentId: student.id } });

    // payments
    if (plan === "LOCKED_UNPAID") {
      await prisma.payment.create({
        data: {
          transactionId: `MSYTXN${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
          studentId: student.id,
          gateway: "SANDBOX",
          orderId: `sbx_order_${crypto.randomBytes(8).toString("hex")}`,
          amount: fee!,
          status: i % 2 ? "FAILED" : "CREATED",
          failureReason: i % 2 ? "Payment declined by bank" : null,
          createdAt: daysAgo(int(0, 5)),
        },
      });
    }
    if (paymentStatus === "PAID") {
      const gw = rand() < 0.6 ? "RAZORPAY" : "CASHFREE";
      if (i % 5 === 0) {
        // an earlier failed attempt
        await prisma.payment.create({
          data: { transactionId: `MSYTXN${crypto.randomBytes(5).toString("hex").toUpperCase()}`, studentId: student.id, gateway: gw, orderId: `order_${crypto.randomBytes(7).toString("hex")}`, amount: fee!, status: "FAILED", failureReason: "UPI transaction timed out", createdAt: addDaysD(registeredAt, 0) },
        });
      }
      await prisma.payment.create({
        data: {
          transactionId: `MSYTXN${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
          studentId: student.id,
          gateway: gw,
          orderId: gw === "RAZORPAY" ? `order_${crypto.randomBytes(7).toString("hex")}` : `MSYCF${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
          gatewayPaymentId: gw === "RAZORPAY" ? `pay_${crypto.randomBytes(7).toString("hex")}` : String(int(100000000, 999999999)),
          amount: fee!,
          method: pick(["upi", "upi", "upi", "card", "netbanking"]),
          status: "SUCCESS",
          paidAt: registeredAt,
          receiptNo: `MSY/RCPT/${new Date().getFullYear()}/${String(++receiptSeq).padStart(6, "0")}`,
          receiptGeneratedAt: registeredAt,
          createdAt: registeredAt,
        },
      });
      notes.push({ userId: user.id, title: "Payment successful — welcome to MSY College!", body: `Your MSY College Registration Number is ${student.portalRegNo}.`, kind: "PAYMENT", link: "/student/downloads", createdAt: registeredAt });
    }

    // delivery data
    if (start && (plan === "ACTIVE" || plan === "COMPLETED" || plan === "BLOCKED")) {
      const lastDay = plan === "COMPLETED" ? end! : daysAgo(1);
      const days = workingDays(start, lastDay < end! ? lastDay : end!);
      const diligence = isDemo ? 0.93 : plan === "COMPLETED" ? 0.95 : 0.7 + rand() * 0.27;
      const att: { studentId: string; date: string; checkIn: Date | null; checkOut: Date | null; status: string; remarks: string | null; learningSeconds: number }[] = [];
      const logs: { studentId: string; date: string; hours: number; activity: string; skills: string }[] = [];
      let leaveUsed = 0;
      for (const day of days) {
        const r = rand();
        if (r < diligence) {
          const half = rand() < 0.08;
          const inH = int(9, 10);
          att.push({ studentId: student.id, date: day, checkIn: at(day, inH, int(0, 50)), checkOut: at(day, half ? inH + 3 : inH + int(4, 6), int(0, 55)), status: half ? "HALF_DAY" : "PRESENT", remarks: null, learningSeconds: int(40, 110) * 60 });
          if (rand() < (plan === "COMPLETED" ? 1 : 0.93)) logs.push({ studentId: student.id, date: day, hours: half ? 2 : pick([3, 3.5, 4, 4, 4.5, 5]), activity: pick(ACTIVITIES), skills: shuffle([...SKILLS]).slice(0, 2).join(", ") });
        } else if (leaveUsed < 2 && rand() < 0.5) {
          leaveUsed++;
          att.push({ studentId: student.id, date: day, checkIn: null, checkOut: null, status: "LEAVE", remarks: "Medical leave (approved by mentor)", learningSeconds: 0 });
        } else att.push({ studentId: student.id, date: day, checkIn: null, checkOut: null, status: "ABSENT", remarks: null, learningSeconds: 0 });
      }
      // completed students: top up logbook to reach 120 h
      if (plan === "COMPLETED") {
        let total = logs.reduce((a, l) => a + l.hours, 0);
        for (const l of logs) {
          if (total >= 121) break;
          const add = Math.min(2, 121 - total);
          l.hours += add;
          total += add;
        }
      }
      await prisma.attendance.createMany({ data: att });
      await prisma.logbookEntry.createMany({ data: logs });
      const learningSeconds = att.reduce((a, x) => a + x.learningSeconds, 0);
      await prisma.student.update({ where: { id: student.id }, data: { learningSeconds } });

      // learning progress
      const chapters = chapterOrder.get(domainCode!)!;
      const done = plan === "COMPLETED" ? chapters.length : Math.min(chapters.length, Math.round((days.length / 36) * chapters.length * (0.6 + rand() * 0.5)));
      for (const [ci, ch] of chapters.entries()) {
        if (ci > done) break;
        const completed = ci < done;
        const completedAt = at(days[Math.min(days.length - 1, Math.floor((ci / chapters.length) * days.length))] ?? today, 15, 0);
        await prisma.chapterProgress.create({
          data: { studentId: student.id, chapterId: ch.id, watchSeconds: completed ? 60 + int(0, 900) : int(0, 50), readSeconds: completed ? 45 + int(0, 400) : int(0, 30), completed, completedAt: completed ? completedAt : null, completedVia: completed ? "QUIZ" : null },
        });
        if (ch.quizId && completed) {
          const failedFirst = rand() < 0.2;
          if (failedFirst) {
            const sc = Math.max(0, Math.floor(ch.maxScore * 0.4));
            await prisma.quizAttempt.create({ data: { quizId: ch.quizId, studentId: student.id, startedAt: completedAt, submittedAt: completedAt, questionOrder: JSON.stringify(ch.questionIds), answers: "{}", score: sc, maxScore: ch.maxScore, percent: Math.round((sc / ch.maxScore) * 100), passed: false } });
          }
          const sc = Math.max(Math.ceil(ch.maxScore * 0.6), ch.maxScore - int(0, 1));
          await prisma.quizAttempt.create({ data: { quizId: ch.quizId, studentId: student.id, startedAt: completedAt, submittedAt: completedAt, questionOrder: JSON.stringify(ch.questionIds), answers: "{}", score: sc, maxScore: ch.maxScore, percent: Math.round((sc / ch.maxScore) * 1000) / 10, passed: true } });
        } else if (ch.quizId && !completed && rand() < 0.3) {
          // exhausted attempts on the current chapter → needs a reattempt grant
          for (let a = 0; a < 3; a++)
            await prisma.quizAttempt.create({ data: { quizId: ch.quizId, studentId: student.id, startedAt: daysAgo(3 - a), submittedAt: daysAgo(3 - a), questionOrder: JSON.stringify(ch.questionIds), answers: "{}", score: 1, maxScore: ch.maxScore, percent: Math.round((1 / ch.maxScore) * 1000) / 10, passed: false } });
        }
      }

      // submissions
      const assignments = await prisma.assignment.findMany({ where: { domainId: domainIds.get(domainCode!)! }, orderBy: { dueDate: "asc" } });
      const subFile = async (label: string) => (await saveFile(await simplePdf(label, [`Student: ${name}`, `Registration No: ${regNo}`, "Demo submission generated by seed."]), `${label.replace(/\W+/g, "_")}.pdf`, "application/pdf", "SUBMISSION", { ownerUserId: user.id, studentId: student.id })).id;
      for (const [ai, a] of assignments.entries()) {
        if (plan !== "COMPLETED" && (ai > 0 || rand() < 0.25)) continue;
        const approved = plan === "COMPLETED" || rand() < 0.45;
        await prisma.submission.create({
          data: {
            studentId: student.id,
            kind: "ASSIGNMENT",
            assignmentId: a.id,
            fileId: await subFile(a.title),
            status: approved ? "APPROVED" : rand() < 0.2 ? "RESUBMIT" : "PENDING",
            marks: approved ? int(Math.round(a.maxMarks * 0.65), a.maxMarks) : null,
            feedback: approved ? "Well structured and clearly explained. Good use of examples." : null,
            reviewedById: approved ? mentor!.userId : null,
            reviewedAt: approved ? daysAgo(int(1, 10)) : null,
            submittedAt: daysAgo(int(2, 14)),
          },
        });
      }
      if (plan === "COMPLETED" || (plan === "ACTIVE" && rand() < 0.5) || isDemo) {
        const approved = plan === "COMPLETED";
        await prisma.submission.create({
          data: {
            studentId: student.id,
            kind: "PROJECT",
            title: `${DOMAINS.find((d) => d.code === domainCode)!.name} live project — ${pick(["local business case", "college utility", "community survey", "market study"])}`,
            description: "Live project undertaken during the internship with weekly mentor check-ins.",
            fileId: await subFile("Live Project Report"),
            status: approved ? "APPROVED" : "PENDING",
            feedback: approved ? "Excellent practical application." : null,
            reviewedById: approved ? mentor!.userId : null,
            reviewedAt: approved ? addDaysD(end!, -3) : null,
            submittedAt: approved ? addDaysD(end!, -6) : daysAgo(int(1, 4)),
          },
        });
      }
      if (plan === "COMPLETED" || (plan === "ACTIVE" && !isDemo && rand() < 0.25)) {
        const approved = plan === "COMPLETED";
        await prisma.submission.create({
          data: { studentId: student.id, kind: "REPORT", title: "Final internship report (signed)", fileId: await subFile("Internship Report"), status: approved ? "APPROVED" : "PENDING", reviewedById: approved ? mentor!.userId : null, reviewedAt: approved ? addDaysD(end!, -1) : null, submittedAt: approved ? addDaysD(end!, -2) : daysAgo(1) },
        });
      }

      // completed: assessment, results, certificate
      if (plan === "COMPLETED") {
        const vals = ["VERY_GOOD", "VERY_GOOD", "GOOD", "GOOD", "SATISFACTORY"];
        const keys = ["technical", "problemSolving", "communication", "teamwork", "punctuality", "initiative", "projectQuality"];
        const ratings = Object.fromEntries(keys.map((k) => [k, pick(vals)]));
        const scoreMap: Record<string, number> = { VERY_GOOD: 100, GOOD: 80, SATISFACTORY: 60, NEEDS_IMPROVEMENT: 40 };
        const score = Math.round((Object.values(ratings).reduce((a, r) => a + scoreMap[r]!, 0) / keys.length) * 10) / 10;
        await prisma.assessment.create({ data: { studentId: student.id, mentorId: mentor!.id, ratings: JSON.stringify(ratings), remarks: "Consistent, sincere and eager to learn. Delivered a strong live project.", recommendCertificate: true, score, submittedAt: addDaysD(end!, -1) } });
        const final = Math.round((88 * 0.4 + score * 0.4 + 92 * 0.2) * 10) / 10;
        const grade = final >= 90 ? "O" : final >= 80 ? "A+" : final >= 70 ? "A" : "B+";
        await prisma.student.update({ where: { id: student.id }, data: { resultStatus: "PASS", grade, resultPublishedAt: end!, completedAt: end! } });
        await prisma.certificate.create({ data: { studentId: student.id, certificateNo: `MSY/CERT/${new Date().getFullYear()}/${String(++certSeq).padStart(6, "0")}`, verifyCode: isDemo === "done" ? "MSYDEMO2026" : crypto.randomBytes(5).toString("hex").toUpperCase(), issuedAt: end! } });
      }
      // a few active students already assessed
      if (plan === "ACTIVE" && !isDemo && rand() < 0.2) {
        await prisma.assessment.create({ data: { studentId: student.id, mentorId: mentor!.id, ratings: JSON.stringify({ technical: "GOOD", problemSolving: "GOOD", communication: "VERY_GOOD", teamwork: "GOOD", punctuality: "SATISFACTORY", initiative: "GOOD", projectQuality: "GOOD" }), remarks: "Progressing well.", recommendCertificate: true, score: 80 } });
      }
    }
  }

  // sequence counters
  await prisma.setting.createMany({
    data: [
      { key: "seq:student", value: JSON.stringify(studentSeq) },
      { key: `seq:portal-${new Date().getFullYear()}`, value: JSON.stringify(portalSeq) },
      { key: `seq:receipt-${new Date().getFullYear()}`, value: JSON.stringify(receiptSeq) },
      { key: `seq:cert-${new Date().getFullYear()}`, value: JSON.stringify(certSeq) },
    ],
  });

  // ── settlements ──
  for (const c of colleges.slice(0, 4)) {
    const paid = await prisma.payment.aggregate({ where: { status: "SUCCESS", student: { collegeId: c.id } }, _sum: { amount: true } });
    const earned = Math.round(((paid._sum.amount ?? 0) * c.share) / 100);
    const first = Math.round(earned * 0.5);
    if (first > 0) {
      await prisma.collegeSettlement.create({ data: { collegeId: c.id, amount: first, mode: "BANK_TRANSFER", reference: `UTR${int(100000000000, 999999999999)}`, remarks: "First settlement for the current session", date: daysAgo(40), recordedById: admin.id } });
      if (c.code !== "KCC") await prisma.collegeSettlement.create({ data: { collegeId: c.id, amount: Math.round(earned * 0.2), mode: "UPI", reference: `UPI${int(1000000000, 9999999999)}`, remarks: "Interim settlement", date: daysAgo(10), recordedById: admin.id } });
    }
  }

  // ── live classes ──
  const now = new Date();
  for (const [i, d] of DOMAINS.entries()) {
    const firstModule = await prisma.module.findFirst({ where: { domainId: domainIds.get(d.code)! }, orderBy: { number: "asc" } });
    await prisma.liveClass.createMany({
      data: [
        { title: `${d.name}: weekly doubt-clearing session`, domainId: domainIds.get(d.code)!, meetingLink: "https://meet.google.com/abc-defg-hij", startsAt: new Date(now.getTime() + (i === 0 ? 25 : 60 * 26 + i * 90) * 60 * 1000), durationMinutes: 60, trainer: MENTOR_NAMES[i]!, popupMinutes: 30 },
        { title: `${d.name}: ${firstModule?.name ?? "Module 1"} masterclass`, domainId: domainIds.get(d.code)!, moduleId: firstModule?.id, meetingLink: "https://meet.google.com/xyz-abcd-efg", startsAt: new Date(now.getTime() + (3 * 24 + i) * 60 * 60 * 1000), durationMinutes: 90, trainer: "Guest Expert", popupMinutes: 15 },
        { title: `${d.name}: orientation`, domainId: domainIds.get(d.code)!, meetingLink: "https://meet.google.com/ori-enta-tion", startsAt: daysAgo(14), durationMinutes: 60, trainer: MENTOR_NAMES[i]!, popupMinutes: 10 },
      ],
    });
  }

  // ── routines ──
  const routineBytes = await simplePdf("Internship Routine — Session 2026", [
    "Mon–Fri  10:00–11:00  Recorded lecture + notes",
    "Mon–Fri  11:00–12:30  Practice / assignment work",
    "Wed      16:00–17:00  Live doubt-clearing class",
    "Sat      10:00–12:00  Live project work + logbook",
    "Daily    Mark attendance (check-in/check-out) and fill your logbook",
  ]);
  const routineFile = await saveFile(routineBytes, "Internship_Routine_2026.pdf", "application/pdf", "ROUTINE");
  await prisma.routine.createMany({
    data: [
      { title: "Internship routine — Session 2026", description: "Daily and weekly schedule for all domains. Follow it to complete 120 hours on time.", fileId: routineFile.id, publishAt: daysAgo(35), active: true },
      { title: "Draft routine (hidden)", description: "Next batch routine — not yet published.", fileId: routineFile.id, publishAt: daysAgo(-7), active: false },
    ],
  });

  // ── announcements ──
  const paidStudents = await prisma.student.findMany({ where: { paymentStatus: "PAID", userId: { not: null } }, select: { userId: true } });
  for (const s of paidStudents) {
    notes.push({ userId: s.userId!, title: "Welcome to the 2026 internship batch", body: "Mark your attendance daily, complete chapters in order and keep your logbook updated. Live classes run every week — watch for reminders.", kind: "MESSAGE", createdAt: daysAgo(12) });
  }
  await prisma.notification.createMany({ data: notes.map((n) => ({ ...n, link: n.link ?? null, read: false })) });

  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.id, action: "COLLEGE_CREATE", entity: "College", entityId: colleges[0]!.id, details: JSON.stringify({ code: "GVDC" }), createdAt: daysAgo(200) },
      { actorId: admin.id, action: "DOMAIN_FEE", entity: "College", entityId: colleges[0]!.id, details: JSON.stringify({ domain: "WEB", fee: 179900 }), createdAt: daysAgo(190) },
      { actorId: admin.id, action: "SETTLEMENT", entity: "College", entityId: colleges[0]!.id, details: JSON.stringify({ note: "seed" }), createdAt: daysAgo(40) },
    ],
  });

  const counts = await Promise.all([prisma.student.count(), prisma.payment.count(), prisma.attendance.count(), prisma.chapter.count(), prisma.question.count()]);
  console.log(`Done: ${counts[0]} students, ${counts[1]} payments, ${counts[2]} attendance rows, ${counts[3]} chapters, ${counts[4]} questions.`);
  const sample = await prisma.student.findFirst({ where: { nextStep: 1, college: { status: "ACTIVE" } }, select: { registrationNumber: true } });
  console.log(`Try registration with university reg. no.: ${sample?.registrationNumber}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
