"use client";
import { useEffect, useMemo, useState } from "react";
import { Layers, RotateCcw, Save, Search, IndianRupee } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { formatINR } from "@/lib/format";
import { Card, CardFooter } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { cn } from "@/components/ui/cn";

export interface FeeRow {
  id: string;
  code: string;
  name: string;
  sector: string;
  active: boolean;
  defaultFee: number; // paise
  customFee: number | null; // paise
}

const toInput = (paise: number | null) => (paise === null ? "" : String(paise / 100));

/** Validate a rupee input. Returns an error message or null. Blank = use default. */
function feeError(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return "Enter an amount with up to 2 decimals";
  const n = Number(s);
  if (!(n > 0)) return "Fee must be greater than ₹0";
  if (n > 1_000_000) return "Fee is too large";
  return null;
}

export function DomainFeesEditor({ collegeId, domains }: { collegeId: string; domains: FeeRow[] }) {
  const initial = useMemo(() => Object.fromEntries(domains.map((d) => [d.id, toInput(d.customFee)])), [domains]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFee, setBulkFee] = useState("");
  const [bulkScope, setBulkScope] = useState<"selected" | "all">("selected");
  const [resetScope, setResetScope] = useState<"selected" | "all" | null>(null);
  const save = useAction();
  const bulk = useAction();
  const reset = useAction();

  // Re-sync after the server data refreshes.
  useEffect(() => {
    setValues(initial);
    setSelected(new Set());
  }, [initial]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter((d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q) || d.sector.toLowerCase().includes(q));
  }, [domains, query]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const d of domains) {
      const err = feeError(values[d.id] ?? "");
      if (err) e[d.id] = err;
    }
    return e;
  }, [domains, values]);

  const dirtyIds = domains.filter((d) => (values[d.id] ?? "").trim() !== (initial[d.id] ?? "")).map((d) => d.id);
  const customCount = domains.filter((d) => d.customFee !== null).length;
  const allVisibleSelected = visible.length > 0 && visible.every((d) => selected.has(d.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allVisibleSelected) visible.forEach((d) => n.delete(d.id));
      else visible.forEach((d) => n.add(d.id));
      return n;
    });

  const onSave = async () => {
    if (dirtyIds.some((id) => errors[id])) return;
    const fees = dirtyIds.map((domainId) => {
      const s = (values[domainId] ?? "").trim();
      return { domainId, fee: s ? Number(s) : null };
    });
    await save.run(() => api<{ changed: number }>(`/api/admin/colleges/${collegeId}/domain-fees`, { body: { action: "save", fees } }), {
      success: "Domain fees saved",
      successDescription: `${fees.length} domain${fees.length === 1 ? "" : "s"} updated.`,
      refresh: true,
    });
  };

  const bulkErr = bulkFee.trim() === "" ? "Enter a fee" : feeError(bulkFee);
  const onBulk = async () => {
    if (bulkErr) return;
    const domainIds = bulkScope === "all" ? "all" : [...selected];
    const res = await bulk.run(
      () => api<{ changed: number }>(`/api/admin/colleges/${collegeId}/domain-fees`, { body: { action: "bulk", domainIds, fee: Number(bulkFee) } }),
      { success: "Bulk fee applied", refresh: true },
    );
    if (res) {
      setBulkOpen(false);
      setBulkFee("");
    }
  };

  const onReset = async () => {
    if (!resetScope) return;
    const domainIds = resetScope === "all" ? "all" : [...selected];
    const res = await reset.run(() => api<{ changed: number }>(`/api/admin/colleges/${collegeId}/domain-fees`, { body: { action: "reset", domainIds } }), {
      success: "Fees reset to default",
      refresh: true,
    });
    if (res) setResetScope(null);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <div className="w-full sm:w-72">
          <Input leading={<Search className="size-4" />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter domains…" aria-label="Filter domains" />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">
            {customCount} custom · {selected.size} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            icon={<Layers className="size-4" />}
            onClick={() => {
              setBulkScope(selected.size ? "selected" : "all");
              setBulkOpen(true);
            }}
          >
            Bulk set fee
          </Button>
          <Button variant="outline" size="sm" icon={<RotateCcw className="size-4" />} disabled={!selected.size} onClick={() => setResetScope("selected")}>
            Reset selected
          </Button>
          <Button variant="ghost" size="sm" disabled={!customCount} onClick={() => setResetScope("all")}>
            Reset all
          </Button>
        </div>
      </div>

      <Table>
        <THead>
          <tr>
            <TH className="w-10">
              <input type="checkbox" className="size-4 accent-brand-600" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all domains" />
            </TH>
            <TH>Domain</TH>
            <TH>Sector</TH>
            <TH className="text-right">Default fee</TH>
            <TH>Custom fee (₹)</TH>
            <TH className="text-right">Effective fee</TH>
          </tr>
        </THead>
        <TBody>
          {visible.length === 0 && <EmptyRow colSpan={6}>{domains.length ? "No domains match this filter." : "No domains have been set up yet. Add domains in Learning Setup."}</EmptyRow>}
          {visible.map((d) => {
            const raw = values[d.id] ?? "";
            const err = errors[d.id];
            const effective = !err && raw.trim() ? Math.round(Number(raw) * 100) : d.defaultFee;
            const isCustom = !err && raw.trim() !== "";
            const dirty = raw.trim() !== (initial[d.id] ?? "");
            return (
              <TR key={d.id} className={cn(selected.has(d.id) && "bg-brand-50/40")}>
                <TD>
                  <input type="checkbox" className="size-4 accent-brand-600" checked={selected.has(d.id)} onChange={() => toggle(d.id)} aria-label={`Select ${d.name}`} />
                </TD>
                <TD>
                  <div className="font-medium text-slate-900">{d.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-mono">{d.code}</span>
                    {!d.active && <Badge tone="gray">Inactive</Badge>}
                  </div>
                </TD>
                <TD className="text-slate-500">{d.sector}</TD>
                <TD className="text-right tabular-nums">{formatINR(d.defaultFee)}</TD>
                <TD className="min-w-44">
                  <Input
                    inputMode="decimal"
                    value={raw}
                    onChange={(e) => setValues((s) => ({ ...s, [d.id]: e.target.value.replace(/[^\d.]/g, "") }))}
                    placeholder="Use default"
                    invalid={Boolean(err)}
                    aria-label={`Custom fee for ${d.name}`}
                    aria-invalid={Boolean(err)}
                    leading={<IndianRupee className="size-3.5" />}
                    className={cn("h-9", dirty && !err && "border-amber-400")}
                  />
                  {err && <p className="mt-1 text-xs font-medium text-rose-600">{err}</p>}
                </TD>
                <TD className="text-right whitespace-nowrap">
                  <span className="font-semibold text-slate-900 tabular-nums">{formatINR(effective)}</span>
                  <div className="text-xs">{isCustom ? <span className="text-brand-700">Custom</span> : <span className="text-slate-400">Default</span>}</div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <CardFooter className="justify-between">
        <span className="text-sm text-slate-500">{dirtyIds.length ? `${dirtyIds.length} unsaved change${dirtyIds.length === 1 ? "" : "s"}` : "All changes saved"}</span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!dirtyIds.length || save.loading} onClick={() => setValues(initial)}>
            Discard
          </Button>
          <Button icon={<Save className="size-4" />} loading={save.loading} disabled={!dirtyIds.length || dirtyIds.some((id) => errors[id])} onClick={onSave}>
            Save fees
          </Button>
        </div>
      </CardFooter>

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk set fee"
        description="Apply one custom fee to several domains at once."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulk.loading}>
              Cancel
            </Button>
            <Button onClick={onBulk} loading={bulk.loading} disabled={Boolean(bulkErr) || (bulkScope === "selected" && !selected.size)}>
              Apply fee
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium text-slate-700">Apply to</legend>
            <label className={cn("flex items-center gap-2 text-sm", !selected.size && "opacity-50")}>
              <input type="radio" name="scope" className="accent-brand-600" checked={bulkScope === "selected"} disabled={!selected.size} onChange={() => setBulkScope("selected")} />
              Selected domains ({selected.size})
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="scope" className="accent-brand-600" checked={bulkScope === "all"} onChange={() => setBulkScope("all")} />
              All domains ({domains.length})
            </label>
          </fieldset>
          <Field label="Fee (₹)" htmlFor="bulkFee" required error={bulkFee ? bulkErr : null} hint="Must be greater than ₹0.">
            <Input id="bulkFee" inputMode="decimal" value={bulkFee} onChange={(e) => setBulkFee(e.target.value.replace(/[^\d.]/g, ""))} leading={<IndianRupee className="size-3.5" />} autoFocus />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={resetScope !== null}
        onClose={() => setResetScope(null)}
        onConfirm={onReset}
        loading={reset.loading}
        tone="danger"
        confirmLabel="Reset to default"
        title={resetScope === "all" ? "Reset all custom fees?" : `Reset ${selected.size} selected domain${selected.size === 1 ? "" : "s"}?`}
        description="Custom fees will be removed and students will be charged the domain default fee. Fees already captured at registration are not affected."
      />
    </Card>
  );
}
