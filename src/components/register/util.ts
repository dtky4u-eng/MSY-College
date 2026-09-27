"use client";
import { ApiClientError } from "@/lib/client/api";
import type { TFn } from "@/lib/i18n";

/** Translate a server error by its `code` (when the dictionary has it), else fall back to the server message. */
export function errText(e: unknown, t: TFn): string {
  if (e instanceof ApiClientError) {
    const code = e.fields?.code;
    if (code) {
      const key = `reg.err.${code}`;
      const s = t(key);
      if (s !== key) return s;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : t("error.generic");
}

export function errCode(e: unknown): string | undefined {
  return e instanceof ApiClientError ? e.fields?.code : undefined;
}

/** Field errors from a 422/409 response, without the synthetic `code` entry. */
export function errFields(e: unknown): Record<string, string> {
  if (!(e instanceof ApiClientError) || !e.fields) return {};
  const { code: _code, ...rest } = e.fields;
  return rest;
}

const scripts = new Map<string, Promise<void>>();

/** Load a third-party script once (payment gateway SDKs). */
export function loadScript(src: string): Promise<void> {
  const existing = scripts.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scripts.delete(src);
      el.remove();
      reject(new Error("script_load_failed"));
    };
    document.head.appendChild(el);
  });
  scripts.set(src, p);
  return p;
}

export function humanSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
