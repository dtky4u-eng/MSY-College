// Human-readable identifiers.
import "server-only";
import crypto from "node:crypto";
import { nextSequence } from "./settings";

const pad = (n: number, w = 6) => String(n).padStart(w, "0");
const year = () => new Date().getFullYear();

export async function newStudentCode() {
  return `STU-${pad(await nextSequence("student"))}`;
}

/** MSY College registration number, issued on successful payment (FR-REG-3). */
export async function newPortalRegNo() {
  return `MSY${String(year()).slice(2)}${pad(await nextSequence(`portal-${year()}`))}`;
}

export async function newReceiptNo() {
  return `MSY/RCPT/${year()}/${pad(await nextSequence(`receipt-${year()}`))}`;
}

export async function newCertificateNo() {
  return `MSY/CERT/${year()}/${pad(await nextSequence(`cert-${year()}`))}`;
}

export function newTransactionId() {
  return `MSYTXN${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

const B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newVerifyCode(len = 10) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += B32[bytes[i]! % B32.length];
  return out;
}
