import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, makeT, normalizeLang, type Lang } from "./index";

export async function getLang(): Promise<Lang> {
  return normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
}

/** Server-component translator: `const t = await getT();` */
export async function getT() {
  return makeT(await getLang());
}
