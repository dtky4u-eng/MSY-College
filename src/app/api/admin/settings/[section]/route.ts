import { z } from "zod";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getEligibilityRules, getInternshipSettings, getSetting, setSetting, type PaymentSettings } from "@/lib/settings";

const percent = (label: string) => z.coerce.number({ message: `Enter ${label}` }).int(`${label} must be a whole number`).min(0, `${label} cannot be negative`).max(100, `${label} cannot exceed 100`);

const eligibility = z.object({
  minAttendancePercent: percent("Minimum attendance"),
  minHoursPercent: percent("Minimum hours"),
  minQuizAverage: percent("Minimum quiz average"),
  requireAllChapters: z.boolean(),
  requireProjectApproved: z.boolean(),
  requireReportApproved: z.boolean(),
  requireMentorRecommendation: z.boolean(),
});

const internship = z.object({
  defaultWeeks: z.coerce.number({ message: "Enter the duration in weeks" }).int("Use whole weeks").min(1, "At least 1 week").max(52, "At most 52 weeks"),
  checkInFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)"),
  halfDayBelowHours: z.coerce.number({ message: "Enter hours" }).min(0.5, "At least 0.5 hours").max(12, "At most 12 hours"),
});

const payments = z.object({ gateway: z.enum(["auto", "razorpay", "cashfree", "sandbox"], { message: "Choose a gateway" }) });

/** Update a settings section (certificate eligibility, internship defaults, payment gateway). Audited as SETTINGS. */
export const PUT = route<{ section: string }>(async (req, { params }) => {
  const { section } = await params;
  const auth = await requireApiRole("ADMIN");
  if (section === "eligibility") {
    const body = await parseBody(req, eligibility);
    const before = await getEligibilityRules();
    await setSetting("eligibility", body);
    await audit(auth.user.id, "SETTINGS", "Setting", "eligibility", { before, after: body });
    return body;
  }
  if (section === "internship") {
    const body = await parseBody(req, internship);
    const before = await getInternshipSettings();
    await setSetting("internship", body);
    await audit(auth.user.id, "SETTINGS", "Setting", "internship", { before, after: body });
    return body;
  }
  if (section === "payments") {
    const body = await parseBody(req, payments);
    const before = await getSetting<PaymentSettings>("payments", { gateway: "auto" });
    await setSetting("payments", { gateway: body.gateway });
    await audit(auth.user.id, "SETTINGS", "Setting", "payments", { before, after: body });
    return body;
  }
  throw new ApiError(404, "Unknown settings section");
});
