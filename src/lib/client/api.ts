"use client";
// Browser fetch helper for the { ok, data | error, fields } API envelope.
// Retries once after refreshing the access token on 401.

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

type Opts = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown; // JSON body
  form?: FormData; // multipart body
  signal?: AbortSignal;
};

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

export async function api<T = unknown>(url: string, opts: Opts = {}, retried = false): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"), signal: opts.signal };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { "Content-Type": "application/json" };
  }
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiClientError("Network error — please check your connection and try again.", 0);
  }
  if (res.status === 401 && !retried && !url.startsWith("/api/auth/")) {
    if (await tryRefresh()) return api<T>(url, opts, true);
    if (typeof window !== "undefined" && /^\/(student|college|mentor|admin)(\/|$)/.test(window.location.pathname)) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}&expired=1`;
    }
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new ApiClientError(json?.error ?? `Request failed (${res.status})`, res.status, json?.fields);
  }
  return json.data as T;
}

/** Trigger a browser download for a same-origin URL (document/receipt/export endpoints). */
export function download(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
