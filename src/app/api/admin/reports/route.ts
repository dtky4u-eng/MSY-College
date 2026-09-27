import { pagination, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { buildReport, parseFilters, parseType } from "@/app/admin/reports/_lib/build";

/** Paginated report preview as JSON (FR-ADM-14). */
export const GET = route(async (req) => {
  await requireApiRole("ADMIN");
  const sp = req.nextUrl.searchParams;
  const { page, pageSize, skip, take } = pagination(sp, 25);
  const report = await buildReport(parseType(sp.get("type")), parseFilters(sp), { skip, take });
  return { page, pageSize, ...report };
});
