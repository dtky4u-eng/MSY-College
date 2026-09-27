import { z } from "zod";
import { zEmail, zMobile10, zPassword, zPincode, zUsername } from "@/lib/http";

/** Treat blank strings as "not provided". */
export const blank = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

const text = (label: string, max = 150) => z.string().trim().min(2, `${label} is required`).max(max, `${label} is too long`);

const base = {
  name: text("College name", 200),
  university: text("University", 200),
  principal: blank(z.string().trim().max(120)),
  coordinator: blank(z.string().trim().max(120)),
  email: blank(zEmail),
  mobile: blank(zMobile10),
  state: blank(z.string().trim().max(80)),
  district: blank(z.string().trim().max(80)),
  pincode: blank(zPincode),
  address: blank(z.string().trim().max(500)),
  collegeShare: z.coerce.number({ message: "Enter the college share" }).min(0, "Share cannot be negative").max(100, "Share cannot exceed 100%"),
  rknexoraShare: z.coerce.number({ message: "Enter the MSY College share" }).min(0, "Share cannot be negative").max(100, "Share cannot exceed 100%"),
  status: z.enum(["ACTIVE", "PENDING", "INACTIVE"], { message: "Choose a status" }),
  username: zUsername.transform((v) => v.toLowerCase()),
  loginEmail: blank(zEmail),
};

const sharesTotal = (v: { collegeShare: number; rknexoraShare: number }) => Math.abs(v.collegeShare + v.rknexoraShare - 100) < 0.001;
const sharesMsg = "College share and MSY College share must add up to 100%";

export const createCollegeSchema = z
  .object({
    ...base,
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, "College code must be at least 2 characters")
      .max(12, "College code must be at most 12 characters")
      .regex(/^[A-Z0-9]+$/, "Use uppercase letters and digits only"),
    password: zPassword,
  })
  .refine(sharesTotal, { path: ["collegeShare"], message: sharesMsg })
  .refine(sharesTotal, { path: ["rknexoraShare"], message: sharesMsg });

export const updateCollegeSchema = z
  .object({
    ...base,
    code: z.string().optional(),
    newPassword: blank(zPassword),
    removeLogo: z.string().optional(),
  })
  .refine(sharesTotal, { path: ["collegeShare"], message: sharesMsg })
  .refine(sharesTotal, { path: ["rknexoraShare"], message: sharesMsg });
