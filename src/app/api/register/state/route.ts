import { route } from "@/lib/http";
import { regStateOrThrow, requireRegStudent } from "@/lib/registration";

/** Current wizard state for the student in the registration cookie. */
export const GET = route(async () => {
  const student = await requireRegStudent();
  return { state: await regStateOrThrow(student.id) };
});
