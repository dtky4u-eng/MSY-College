import { headers } from "next/headers";
import { route } from "@/lib/http";
import { clientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { lookupCertificate } from "@/components/public/certificate-lookup";

/** Public JSON certificate verification (for employers / universities integrating with MSY College). */
export const GET = route<{ code: string }>(async (_req, { params }) => {
  const { code } = await params;
  rateLimit(`cert-verify:${clientIp(await headers()) ?? "local"}`, 60, 60 * 1000);
  return lookupCertificate(code);
});
