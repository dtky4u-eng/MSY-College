// Edge-safe JWT helpers (used by middleware and server code). No Node-only imports here.
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./constants";

export const ACCESS_COOKIE = "rk_at";
export const REFRESH_COOKIE = "rk_rt";
export const REG_COOKIE = "rk_reg";

export const ACCESS_TTL_SECONDS = 30 * 60; // 30 minutes
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const REG_TTL_SECONDS = 2 * 60 * 60; // 2 hours

export interface AccessClaims {
  sub: string; // user id
  sid: string; // session id
  role: Role;
  name: string;
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error("JWT_SECRET must be set (min 16 chars)");
  return new TextEncoder().encode(s);
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid, role: claims.role, name: claims.name, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyAccessToken(token: string | undefined): Promise<AccessClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.typ !== "access" || !payload.sub) return null;
    return { sub: payload.sub, sid: String(payload.sid), role: payload.role as Role, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}

/** Short-lived token that carries the registration wizard context (student id). */
export async function signRegToken(studentId: string, verified: boolean): Promise<string> {
  return new SignJWT({ typ: "reg", verified })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(studentId)
    .setIssuedAt()
    .setExpirationTime(`${REG_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyRegToken(token: string | undefined): Promise<{ studentId: string; verified: boolean } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.typ !== "reg" || !payload.sub) return null;
    return { studentId: payload.sub, verified: Boolean(payload.verified) };
  } catch {
    return null;
  }
}
