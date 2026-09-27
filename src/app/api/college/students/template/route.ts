import { route } from "@/lib/http";
import { requireCollege } from "@/lib/auth";
import { studentTemplate } from "@/lib/excel";

/** Download the student database Excel template (FR-COL-2). */
export const GET = route(async () => {
  await requireCollege("api");
  const buf = await studentTemplate();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="MSY College_Student_Template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
