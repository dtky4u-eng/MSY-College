import { headers } from "next/headers";
import { ApiError, route } from "@/lib/http";
import { clientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { createOrderForStudent } from "@/lib/payments";
import { requireRegStudent } from "@/lib/registration";

/** Step 6 — create (or reuse) a gateway order; the server picks the gateway (WF-1). */
export const POST = route(async () => {
  const student = await requireRegStudent();
  if (student.paymentStatus === "PAID") throw new ApiError(409, "Payment already completed. Please sign in.", { code: "PAID" });
  if (!student.registrationLocked) throw new ApiError(409, "Please review and confirm your registration before payment.", { code: "STEP_ORDER" });
  rateLimit(`reg-pay:${student.id}`, 20, 10 * 60 * 1000);
  rateLimit(`reg-pay-ip:${clientIp(await headers()) ?? "local"}`, 60, 10 * 60 * 1000);
  const { checkout } = await createOrderForStudent(student.id);
  return checkout;
});
