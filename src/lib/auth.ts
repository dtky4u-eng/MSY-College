// Server-side authentication: password hashing, sessions (access + refresh tokens),
// and role guards for pages and API routes (AR-1…AR-6, NFR-1, NFR-2).
import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { ROLES, ROLE_HOME, type Role } from "./constants";
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  signAccessToken,
  verifyAccessToken,
} from "./jwt";
import { ApiError } from "./http";

export const PASSWORD_MIN = 8;

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export function sha256(v: string): string {
  return crypto.createHash("sha256").update(v).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

const secureCookies = () => (process.env.APP_URL ?? "").startsWith("https://");

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  role: Role;
  name: string;
}

export interface Auth {
  user: AuthUser;
  sessionId: string;
}

async function displayName(user: { id: string; role: string; username: string }): Promise<string> {
  if (user.role === "STUDENT") {
    const s = await prisma.student.findUnique({ where: { userId: user.id }, select: { name: true } });
    return s?.name ?? user.username;
  }
  if (user.role === "MENTOR") {
    const m = await prisma.mentor.findUnique({ where: { userId: user.id }, select: { name: true } });
    return m?.name ?? user.username;
  }
  if (user.role === "COLLEGE") {
    const c = await prisma.college.findUnique({ where: { adminUserId: user.id }, select: { name: true } });
    return c?.name ?? user.username;
  }
  return "MSY College Admin";
}

async function setAuthCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  const base = { httpOnly: true, sameSite: "lax" as const, secure: secureCookies(), path: "/" };
  jar.set(ACCESS_COOKIE, accessToken, { ...base, maxAge: ACCESS_TTL_SECONDS });
  jar.set(REFRESH_COOKIE, refreshToken, { ...base, maxAge: REFRESH_TTL_SECONDS });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

/** Create a session for a user and set cookies. Returns the role home path. */
export async function startSession(user: { id: string; role: string; username: string }): Promise<string> {
  if (!ROLES.includes(user.role as Role)) throw new ApiError(403, "Unknown role — access denied"); // AR-3
  const h = await headers();
  const refresh = randomToken();
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refresh),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
      ip: clientIp(h),
    },
  });
  const name = await displayName(user);
  const access = await signAccessToken({ sub: user.id, sid: session.id, role: user.role as Role, name });
  await setAuthCookies(access, refresh);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return ROLE_HOME[user.role as Role];
}

/** Rotate the refresh token and issue a new access token. */
export async function refreshSession(): Promise<{ role: Role } | null> {
  const jar = await cookies();
  const token = jar.get(REFRESH_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.active) {
    await clearAuthCookies();
    return null;
  }
  if (!ROLES.includes(session.user.role as Role)) return null;
  const next = randomToken();
  await prisma.session.update({
    where: { id: session.id },
    data: { tokenHash: sha256(next), lastUsedAt: new Date(), expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000) },
  });
  const name = await displayName(session.user);
  const access = await signAccessToken({ sub: session.userId, sid: session.id, role: session.user.role as Role, name });
  await setAuthCookies(access, next);
  return { role: session.user.role as Role };
}

export async function endSession() {
  const jar = await cookies();
  const claims = await verifyAccessToken(jar.get(ACCESS_COOKIE)?.value);
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (claims) await prisma.session.updateMany({ where: { id: claims.sid, revokedAt: null }, data: { revokedAt: new Date() } });
  else if (refresh) await prisma.session.updateMany({ where: { tokenHash: sha256(refresh), revokedAt: null }, data: { revokedAt: new Date() } });
  await clearAuthCookies();
}

/** Revoke every session of a user (after password change/reset or blocking). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

/** Current auth for this request, validated against the session table (logout/revocation aware). */
export const getAuth = cache(async (): Promise<Auth | null> => {
  const jar = await cookies();
  const claims = await verifyAccessToken(jar.get(ACCESS_COOKIE)?.value);
  if (!claims) return null;
  const session = await prisma.session.findUnique({ where: { id: claims.sid }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const u = session.user;
  if (!u.active || u.id !== claims.sub || !ROLES.includes(u.role as Role)) return null;
  return {
    sessionId: session.id,
    user: { id: u.id, username: u.username, email: u.email, role: u.role as Role, name: claims.name },
  };
});

/** Page guard: redirects to /login (or the user's own portal) when access is not allowed. */
export async function requirePageRole(...roles: Role[]): Promise<Auth> {
  const auth = await getAuth();
  if (!auth) redirect("/login?expired=1");
  if (!roles.includes(auth.user.role)) redirect(ROLE_HOME[auth.user.role]);
  return auth;
}

/** API guard: throws 401/403 ApiError. */
export async function requireApiRole(...roles: Role[]): Promise<Auth> {
  const auth = await getAuth();
  if (!auth) throw new ApiError(401, "Your session has expired. Please sign in again.");
  if (roles.length && !roles.includes(auth.user.role)) throw new ApiError(403, "You do not have permission to perform this action.");
  return auth;
}

// ── Role contexts ──

export async function requireStudent(mode: "page" | "api" = "page") {
  const auth = mode === "page" ? await requirePageRole("STUDENT") : await requireApiRole("STUDENT");
  const student = await prisma.student.findUnique({
    where: { userId: auth.user.id },
    include: { college: true, domain: true, mentor: true },
  });
  if (!student) {
    if (mode === "page") redirect("/login");
    throw new ApiError(404, "Student profile not found");
  }
  return { auth, student };
}

export async function requireCollege(mode: "page" | "api" = "page") {
  const auth = mode === "page" ? await requirePageRole("COLLEGE") : await requireApiRole("COLLEGE");
  const college = await prisma.college.findUnique({ where: { adminUserId: auth.user.id } });
  if (!college) {
    if (mode === "page") redirect("/login");
    throw new ApiError(404, "College profile not found");
  }
  return { auth, college };
}

export async function requireMentor(mode: "page" | "api" = "page") {
  const auth = mode === "page" ? await requirePageRole("MENTOR") : await requireApiRole("MENTOR");
  const mentor = await prisma.mentor.findUnique({ where: { userId: auth.user.id }, include: { domain: true } });
  if (!mentor) {
    if (mode === "page") redirect("/login");
    throw new ApiError(404, "Mentor profile not found");
  }
  return { auth, mentor };
}

export function clientIp(h: Headers): string | null {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}
