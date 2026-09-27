import { z } from "zod";
import { parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { bulkFiltersSchema, bulkOperationSchema, bulkOptionsSchema, previewBulk } from "@/lib/jobs/bulk";

const schema = z.object({
  type: bulkOperationSchema,
  filters: bulkFiltersSchema,
  options: bulkOptionsSchema.optional(),
});

/** Dry run: matched/eligible students, working days and estimated records (FR-ADM-13). Changes nothing. */
export const POST = route(async (req) => {
  await requireApiRole("ADMIN");
  const body = await parseBody(req, schema);
  return previewBulk(body.type, body.filters, body.options ?? bulkOptionsSchema.parse({}));
});
