// Minimal mailer. Without an SMTP integration, messages are written to storage/outbox
// and logged to the server console so flows like password reset remain testable locally.
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { storageRoot } from "./files";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(mail: Mail) {
  const dir = path.join(storageRoot(), "outbox");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${mail.to.replace(/[^\w@.-]/g, "_")}.txt`);
  const body = `From: ${process.env.MAIL_FROM ?? "MSY College"}\nTo: ${mail.to}\nSubject: ${mail.subject}\nDate: ${new Date().toISOString()}\n\n${mail.text}\n`;
  await fs.writeFile(file, body, "utf8");
  console.info(`[mail] → ${mail.to}: ${mail.subject} (saved to ${path.relative(process.cwd(), file)})`);
}
