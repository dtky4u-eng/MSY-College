"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertTriangle className="size-7" />
      </div>
      <h1 className="mt-5 text-xl font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        An unexpected error occurred while loading this page. Please try again. If it keeps happening, contact helpdesk@msycollege.org
        {error.digest ? ` quoting reference ${error.digest}` : ""}.
      </p>
      <Button className="mt-6" onClick={reset} icon={<RotateCcw className="size-4" />}>
        Try again
      </Button>
    </div>
  );
}
