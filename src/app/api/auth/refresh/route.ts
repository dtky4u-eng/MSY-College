import { ApiError, route } from "@/lib/http";
import { refreshSession } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/constants";

/** AR-2: rotate the refresh token and issue a new access token. */
export const POST = route(async () => {
  const res = await refreshSession();
  if (!res) throw new ApiError(401, "Session expired. Please sign in again.");
  return { role: res.role, home: ROLE_HOME[res.role] };
});
