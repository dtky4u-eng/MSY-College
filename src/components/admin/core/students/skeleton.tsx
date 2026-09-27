// Loading placeholders for the admin Students and Internships pages.
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

export function ListSkeleton({ stats = 4, rows = 8 }: { stats?: number; rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="mb-6 space-y-2">
        <Bar className="h-7 w-48" />
        <Bar className="h-4 w-80 max-w-full" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: stats }).map((_, i) => (
          <Bar key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
          <Bar className="h-10 w-72 max-w-full" />
          <Bar className="h-10 w-40" />
          <Bar className="h-10 w-32" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <Bar className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Bar className="h-3.5 w-48 max-w-full" />
                <Bar className="h-3 w-32" />
              </div>
              <Bar className="hidden h-5 w-20 sm:block" />
              <Bar className="hidden h-5 w-24 md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="mb-6 space-y-2">
        <Bar className="h-4 w-20" />
        <Bar className="h-7 w-64 max-w-full" />
        <Bar className="h-4 w-96 max-w-full" />
      </div>
      <Bar className="mb-6 h-28 rounded-2xl" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Bar className="h-56 rounded-2xl" />
          <Bar className="h-72 rounded-2xl" />
        </div>
        <div className="space-y-6">
          <Bar className="h-48 rounded-2xl" />
          <Bar className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
