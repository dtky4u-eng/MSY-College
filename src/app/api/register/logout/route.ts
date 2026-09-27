import { route } from "@/lib/http";
import { clearRegCookie } from "@/lib/registration";

/** End the registration session (e.g. "use a different registration number"). */
export const POST = route(async () => {
  await clearRegCookie();
  return { ok: true };
});
