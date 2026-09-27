"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Alert } from "@/components/ui/page";

/**
 * Delete button + confirmation. Server refusals (409 — record in use) are shown inside the dialog
 * so the admin sees exactly why the delete was blocked.
 */
export function DeleteAction({
  url,
  title,
  description,
  children,
  label = "Delete",
  confirmLabel = "Delete",
  success = "Deleted",
  redirectTo,
  size = "sm",
  iconOnly,
  variant = "outline",
}: {
  url: string;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  label?: string;
  confirmLabel?: string;
  success?: string;
  redirectTo?: string;
  size?: "xs" | "sm" | "md";
  iconOnly?: boolean;
  variant?: "outline" | "ghost" | "danger";
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { run, loading, error, setError } = useAction();

  const close = () => {
    if (loading) return;
    setOpen(false);
    setError(null);
  };

  const confirm = async () => {
    const res = await run(() => api(url, { method: "DELETE" }), { success, refresh: !redirectTo, silentError: true });
    if (res === undefined) return;
    setOpen(false);
    if (redirectTo) router.push(redirectTo);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        icon={<Trash2 className="size-4" />}
        aria-label={iconOnly ? `${label}: ${title}` : undefined}
        title={iconOnly ? label : undefined}
        className={variant === "outline" ? "text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700" : variant === "ghost" ? "text-slate-500 hover:bg-rose-50 hover:text-rose-600" : undefined}
      >
        {iconOnly ? null : label}
      </Button>
      <ConfirmDialog open={open} onClose={close} onConfirm={confirm} title={title} description={description} confirmLabel={confirmLabel} tone="danger" loading={loading}>
        <div className="space-y-3">
          {children}
          {error ? (
            <Alert tone="error" icon={<AlertTriangle />} title="Cannot delete">
              {error}
            </Alert>
          ) : (
            <p className="text-sm text-slate-600">This action cannot be undone.</p>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
