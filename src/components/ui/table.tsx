import { cn } from "./cn";

/** Scrollable, responsive table shell. Compose with THead/TBody/TR/TH/TD. */
export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative overflow-x-auto scrollbar-thin", className)}>
      <table className="w-full min-w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">{children}</thead>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function TR({ className, children, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("transition-colors hover:bg-slate-50/70", className)} {...rest}>
      {children}
    </tr>
  );
}

export function TH({ className, children, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("px-4 py-3 whitespace-nowrap first:pl-5 last:pr-5", className)} {...rest}>
      {children}
    </th>
  );
}

export function TD({ className, children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 align-middle text-slate-700 first:pl-5 last:pr-5", className)} {...rest}>
      {children}
    </td>
  );
}

/** Row shown when a table has no data. */
export function EmptyRow({ colSpan, children = "No records found" }: { colSpan: number; children?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}
