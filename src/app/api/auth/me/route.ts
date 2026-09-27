import { route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";

export const GET = route(async () => {
  const auth = await requireApiRole();
  return auth.user;
});
