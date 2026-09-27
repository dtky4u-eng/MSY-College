import { route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { dashboardData } from "@/components/admin/core/dashboard-data";

/** Admin dashboard KPIs and chart series (FR-ADM-1). */
export const GET = route(async () => {
  await requireApiRole("ADMIN");
  return dashboardData();
});
