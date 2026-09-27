// Shared (client-safe) shapes for the registration wizard and payment result screens.

export interface RegOption {
  value: string;
  label: string;
}

export interface RegFile {
  name: string;
  size: number;
  mime: string;
  uploadedAt: string;
}

export interface RegDomain {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sector: string;
  durationHours: number;
  fee: number; // paise, effective for the student's college
  customFee: boolean;
}

export interface RegPaymentSummary {
  id: string;
  status: string;
  transactionId: string;
  amount: number;
  failureReason: string | null;
  createdAt: string;
}

export interface RegState {
  student: {
    name: string;
    registrationNumber: string;
    college: { name: string; university: string; code: string };
    fatherName: string;
    gender: string;
    dob: string; // YYYY-MM-DD
    programme: string;
    majorSubject: string;
    session: string;
    semester: string;
    mobile: string;
    email: string;
    username: string;
    hasAccount: boolean;
    domainId: string | null;
    feeAmount: number | null;
    photo: RegFile | null;
    admitCard: RegFile | null;
    nextStep: number;
    locked: boolean;
    lockedAt: string | null;
    paid: boolean;
    portalRegNo: string | null;
  };
  options: { programmes: RegOption[]; sessions: RegOption[]; semesters: RegOption[] };
  domains: RegDomain[];
  lastPayment: RegPaymentSummary | null;
  successPaymentId: string | null;
}

export type OutcomeStatus = "SUCCESS" | "PENDING" | "FAILED" | "VERIFY_FAILED" | "CREATED" | "REFUNDED";

export interface PaymentOutcome {
  status: OutcomeStatus;
  message: string | null;
  payment: {
    id: string;
    transactionId: string;
    amount: number;
    gateway: string;
    gatewayPaymentId: string | null;
    failureReason: string | null;
    receiptNo: string | null;
    paidAt: string | null;
  };
  student: { name: string; portalRegNo: string | null; username: string | null; domainName: string | null };
}

export type VerifyResponse =
  | { alreadyRegistered: true }
  | { needsPassword: true }
  | { state: RegState };
