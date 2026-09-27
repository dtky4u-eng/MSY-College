import "server-only";
import { z } from "zod";
import type { TFn } from "@/lib/i18n";

/** FR-STU-8 logbook entry validation (messages localised). */
export function logbookSchema(t: TFn) {
  return z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("err.invalidDate")),
    hours: z.coerce
      .number({ error: t("log.err.hours") })
      .min(0.5, t("log.err.hours"))
      .max(12, t("log.err.hours"))
      .refine((v) => Number.isInteger(v * 2), t("log.err.hoursStep")),
    activity: z.string().trim().min(10, t("log.err.activityMin")).max(2000, t("log.err.activityMax")),
    skills: z.string().trim().min(2, t("log.err.skillsMin")).max(500, t("log.err.skillsMax")),
  });
}
