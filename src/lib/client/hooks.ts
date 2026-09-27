"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "./api";

/**
 * Run an async API action with loading/error state, a success toast and an optional router.refresh().
 *   const { run, loading, fields } = useAction();
 *   await run(() => api("/api/x", { body }), { success: "Saved", refresh: true });
 * Returns the action result, or undefined when it failed (the error is toasted and exposed via `error`/`fields`).
 */
export function useAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const toast = useToast();
  const router = useRouter();

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts: { success?: string; successDescription?: string; refresh?: boolean; silentError?: boolean } = {}): Promise<T | undefined> => {
      setLoading(true);
      setError(null);
      setFields({});
      try {
        const res = await fn();
        if (opts.success) toast.success(opts.success, opts.successDescription);
        if (opts.refresh) router.refresh();
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        if (e instanceof ApiClientError && e.fields) setFields(e.fields);
        if (!opts.silentError) toast.error(msg);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [toast, router],
  );

  return { run, loading, error, fields, setFields, setError };
}
