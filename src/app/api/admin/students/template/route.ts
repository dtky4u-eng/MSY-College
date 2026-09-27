import { route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { studentTemplate } from "@/lib/excel";

/** Download the student database Excel template (FR-ADM-6). */
export const GET = route(async () => {
  await requireApiRole("ADMIN");
  const buf = await studentTemplate();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="MSY College_Student_Template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
