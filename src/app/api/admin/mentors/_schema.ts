import { z } from "zod";
import { zEmail, zMobile10, zPassword, zUsername } from "@/lib/http";

const blank = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === null || (typeof v === "string" && v.trim() === "") ? undefined : v), schema.optional());

const base = {
  name: z.string().trim().min(2, "Name is required").max(120, "Name is too long"),
  employeeId: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Employee ID is required")
    .max(30, "Employee ID is too long")
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Use letters, digits, dash or underscore"),
  mobile: blank(zMobile10),
  email: blank(zEmail),
  domainId: z.string().min(1, "Choose a domain"),
  collegeId: blank(z.string().min(1)),
  photoUrl: blank(
    z
      .string()
      .trim()
      .max(500)
      .refine((v) => /^https?:\/\/\S+$/i.test(v) || v.startsWith("/"), "Enter a valid http(s) URL"),
  ),
  designation: blank(z.string().trim().max(120)),
  active: z.boolean(),
  username: blank(zUsername),
};

export const createMentorSchema = z.object({ ...base, password: zPassword });
export const updateMentorSchema = z.object({ ...base, newPassword: blank(zPassword) });
