// Simple in-memory fixed-window rate limiter (per process). Good enough for a single-node deployment.
import { ApiError } from "./http";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count++;
  if (b.count > limit) {
    const secs = Math.ceil((b.resetAt - now) / 1000);
    throw new ApiError(429, `Too many attempts. Please try again in ${secs} seconds.`);
  }
}
