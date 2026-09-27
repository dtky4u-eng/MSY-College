export default function LearningSetupLoading() {
  return (
    <div aria-busy="true" aria-label="Loading learning setup" className="animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-48 rounded-lg bg-slate-200" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-slate-200/70" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4">
          <div className="h-10 rounded-lg bg-slate-100" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-100/80" />
          ))}
        </div>
        <div className="space-y-6">
          <div className="h-44 rounded-2xl border border-slate-200/80 bg-white" />
          <div className="h-80 rounded-2xl border border-slate-200/80 bg-white" />
        </div>
      </div>
    </div>
  );
}
