// Shared enum-like values. Mirrors the string columns in prisma/schema.prisma.

export const ROLES = ["ADMIN", "COLLEGE", "MENTOR", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  COLLEGE: "/college",
  MENTOR: "/mentor",
  STUDENT: "/student",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  COLLEGE: "College",
  MENTOR: "Mentor",
  STUDENT: "Student",
};

export const STUDENT_STATUS = ["PENDING", "ACTIVE", "COMPLETED", "BLOCKED"] as const;
export type StudentStatus = (typeof STUDENT_STATUS)[number];

/** Derived access state shown in the student UI (FR-STU-2). */
export const ACCESS_STATES = ["WAITING", "NOT_STARTED", "ACTIVE", "COMPLETED", "BLOCKED"] as const;
export type AccessState = (typeof ACCESS_STATES)[number];

export const PAYMENT_STATUS = ["CREATED", "PENDING", "SUCCESS", "FAILED", "REFUNDED", "VERIFY_FAILED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const GATEWAYS = ["RAZORPAY", "CASHFREE", "SANDBOX", "MANUAL"] as const;
export type Gateway = (typeof GATEWAYS)[number];

export const ATTENDANCE_STATUS = ["PRESENT", "HALF_DAY", "ABSENT", "LEAVE"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];
export const ATTENDANCE_LABEL: Record<AttendanceStatus | "NOT_MARKED", string> = {
  PRESENT: "Present",
  HALF_DAY: "Half Day",
  ABSENT: "Absent",
  LEAVE: "Approved Leave",
  NOT_MARKED: "Not Marked",
};

export const SUBMISSION_KIND = ["ASSIGNMENT", "PROJECT", "REPORT"] as const;
export type SubmissionKind = (typeof SUBMISSION_KIND)[number];
export const SUBMISSION_STATUS = ["PENDING", "APPROVED", "RESUBMIT"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUS)[number];
export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  PENDING: "Pending Review",
  APPROVED: "Approved",
  RESUBMIT: "Resubmission Requested",
};

export const RESOURCE_TYPES = ["VIDEO", "PDF", "NOTES", "LINK", "CODE", "OTHER"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  VIDEO: "Video",
  PDF: "PDF",
  NOTES: "Text / Notes",
  LINK: "External Link",
  CODE: "Source Code",
  OTHER: "Other",
};

/** Mentor assessment criteria (FR-MEN-6). */
export const ASSESSMENT_CRITERIA = [
  { key: "technical", label: "Technical Knowledge" },
  { key: "problemSolving", label: "Problem Solving" },
  { key: "communication", label: "Communication" },
  { key: "teamwork", label: "Teamwork & Collaboration" },
  { key: "punctuality", label: "Punctuality & Discipline" },
  { key: "initiative", label: "Initiative & Learning Attitude" },
  { key: "projectQuality", label: "Quality of Project Work" },
] as const;
export type CriterionKey = (typeof ASSESSMENT_CRITERIA)[number]["key"];

export const RATINGS = [
  { value: "VERY_GOOD", label: "Very Good", score: 100 },
  { value: "GOOD", label: "Good", score: 80 },
  { value: "SATISFACTORY", label: "Satisfactory", score: 60 },
  { value: "NEEDS_IMPROVEMENT", label: "Needs Improvement", score: 40 },
] as const;
export type Rating = (typeof RATINGS)[number]["value"];

export const DOCUMENT_TYPES = [
  "OFFER_LETTER",
  "ACCEPTANCE_LETTER",
  "ATTENDANCE_SHEET",
  "LOGBOOK",
  "REPORT",
  "MARKSHEET",
  "CERTIFICATE",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  OFFER_LETTER: "Offer Letter",
  ACCEPTANCE_LETTER: "Acceptance Letter",
  ATTENDANCE_SHEET: "Attendance Sheet",
  LOGBOOK: "Digital Logbook",
  REPORT: "Internship Report",
  MARKSHEET: "Assessment Marksheet",
  CERTIFICATE: "Internship Certificate",
};

export const BULK_OPERATIONS = [
  { value: "FULL_LIFECYCLE", label: "Full lifecycle", description: "Attendance → learning → assessment → results → completion → all documents" },
  { value: "ATTENDANCE", label: "Attendance", description: "Generate daily attendance for working days in the internship window" },
  { value: "LEARNING", label: "Learning completion", description: "Mark all chapters complete (with quiz pass records)" },
  { value: "ASSESSMENT", label: "Assessment", description: "Create mentor assessments with certificate recommendation" },
  { value: "RESULTS", label: "Results", description: "Compute and publish results and grades" },
  { value: "COMPLETION", label: "Completion", description: "Mark internships complete and issue certificate numbers" },
  { value: "OFFER_LETTERS", label: "Offer letters", description: "Render offer letters into a ZIP" },
  { value: "ATTENDANCE_SHEETS", label: "Attendance sheets", description: "Render attendance sheets into a ZIP" },
  { value: "LOGBOOKS", label: "Logbooks", description: "Generate logbook entries and render logbooks into a ZIP" },
  { value: "REPORTS", label: "Reports", description: "Render internship reports into a ZIP" },
  { value: "CERTIFICATES", label: "QR certificates", description: "Render QR-verified certificates into a ZIP" },
  { value: "ZIP", label: "Complete ZIP", description: "All available documents per student in one ZIP" },
] as const;
export type BulkOperation = (typeof BULK_OPERATIONS)[number]["value"];

export const SETTLEMENT_MODES = ["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "OTHER"] as const;
export const SETTLEMENT_MODE_LABEL: Record<(typeof SETTLEMENT_MODES)[number], string> = {
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
  CASH: "Cash",
  OTHER: "Other",
};

export const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const;

/** Registration wizard steps (FR-REG). */
export const REG_STEPS = ["verify", "details", "domain", "documents", "review", "payment"] as const;

export const ORG = {
  name: "MSY College",
  brand: "MSY College",
  phone: "+91 9693275424",
  email: "helpdesk@msycollege.org",
  website: "msycollege.org",
  address: "Patna, Bihar, India",
};

/** File limits (NFR-6). */
export const LIMITS = {
  excelBytes: 10 * 1024 * 1024,
  submissionBytes: 10 * 1024 * 1024,
  routineBytes: 10 * 1024 * 1024,
  resourceBytes: 50 * 1024 * 1024,
  imageBytes: 2 * 1024 * 1024,
  documentBytes: 5 * 1024 * 1024,
};
