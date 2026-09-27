"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Megaphone, Search, Send, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/toast";

interface Recipient {
  id: string;
  name: string;
  regNo: string;
  college: string;
  domain: string | null;
}

/** "Send Student Message" (FR-ADM-2): title + message to all paid students or a selected subset. */
export function SendMessageButton({ paidCount }: { paidCount: number }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<"ALL_PAID" | "SELECTED">("ALL_PAID");
  const [selected, setSelected] = useState<Map<string, Recipient>>(new Map());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [clientErr, setClientErr] = useState<Record<string, string>>({});
  const { run, loading, fields } = useAction();
  const toast = useToast();
  const reqId = useRef(0);
  const errors = { ...fields, ...clientErr };

  useEffect(() => {
    if (!open || audience !== "SELECTED") return;
    const id = ++reqId.current;
    setSearching(true);
    setSearchError(null);
    const t = setTimeout(async () => {
      try {
        const data = await api<{ students: Recipient[] }>(`/api/admin/messages?q=${encodeURIComponent(query.trim())}`);
        if (id === reqId.current) setResults(data.students);
      } catch (e) {
        if (id === reqId.current) setSearchError(e instanceof Error ? e.message : "Could not load students");
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, audience]);

  const reset = () => {
    setTitle("");
    setMessage("");
    setAudience("ALL_PAID");
    setSelected(new Map());
    setQuery("");
    setClientErr({});
  };

  const toggle = (r: Recipient) =>
    setSelected((m) => {
      const n = new Map(m);
      if (n.has(r.id)) n.delete(r.id);
      else n.set(r.id, r);
      return n;
    });

  const send = async () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 3) e.title = "Title must be at least 3 characters";
    if (message.trim().length < 5) e.message = "Message must be at least 5 characters";
    if (audience === "SELECTED" && !selected.size) e.studentIds = "Select at least one student";
    setClientErr(e);
    if (Object.keys(e).length) return;
    const res = await run(
      () => api<{ sent: number }>("/api/admin/messages", { body: { title: title.trim(), message: message.trim(), audience, studentIds: audience === "SELECTED" ? [...selected.keys()] : undefined } }),
      {},
    );
    if (res) {
      toast.success("Message sent", `Delivered to ${res.sent} student${res.sent === 1 ? "" : "s"}.`);
      setOpen(false);
      reset();
    }
  };


  return (
    <>
      <Button icon={<Megaphone className="size-4" />} onClick={() => setOpen(true)}>
        Send student message
      </Button>
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title="Send student message"
        description="Appears in the students' notifications and dashboard announcements."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button icon={<Send className="size-4" />} onClick={send} loading={loading} disabled={audience === "ALL_PAID" && paidCount === 0}>
              {audience === "ALL_PAID" ? `Send to ${paidCount} student${paidCount === 1 ? "" : "s"}` : `Send to ${selected.size} selected`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="msg-title" required error={errors.title}>
            <Input id="msg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} invalid={Boolean(errors.title)} placeholder="e.g. Live class schedule updated" />
          </Field>
          <Field label="Message" htmlFor="msg-body" required error={errors.message} hint={`${message.length}/2000`}>
            <Textarea id="msg-body" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} invalid={Boolean(errors.message)} />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">Audience</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["ALL_PAID", "All paid students", `${paidCount} student${paidCount === 1 ? "" : "s"}`],
                  ["SELECTED", "Selected paid students", selected.size ? `${selected.size} selected` : "Search and pick students"],
                ] as const
              ).map(([val, label, sub]) => (
                <label
                  key={val}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition-colors",
                    audience === val ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-400" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <input type="radio" name="audience" className="mt-0.5 accent-brand-600" checked={audience === val} onChange={() => setAudience(val)} />
                  <span>
                    <span className="block font-medium text-slate-900">{label}</span>
                    <span className="text-xs text-slate-500">{sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {audience === "SELECTED" && (
            <div className="space-y-2">
              {selected.size > 0 && (
                <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {[...selected.values()].map((r) => (
                    <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pr-1 pl-2.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
                      {r.name}
                      <button type="button" onClick={() => toggle(r)} className="rounded-full p-0.5 hover:bg-brand-100" aria-label={`Remove ${r.name}`}>
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input leading={<Search className="size-4" />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, registration no., mobile or email" aria-label="Search paid students" />
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200" role="listbox" aria-multiselectable="true">
                {searching && !results.length ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                    <Loader2 className="size-4 animate-spin" /> Searching…
                  </div>
                ) : searchError ? (
                  <p className="py-6 text-center text-sm text-rose-600">{searchError}</p>
                ) : !results.length ? (
                  <p className="py-6 text-center text-sm text-slate-500">No paid students match your search.</p>
                ) : (
                  results.map((r) => {
                    const on = selected.has(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="option"
                        aria-selected={on}
                        onClick={() => toggle(r)}
                        className={cn("flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50", on && "bg-brand-50/50")}
                      >
                        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300")}>
                          {on && <Check className="size-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-900">{r.name}</span>
                          <span className="text-xs text-slate-500">
                            {r.regNo} · {r.college}
                            {r.domain ? ` · ${r.domain}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              {errors.studentIds && <p className="text-xs font-medium text-rose-600">{errors.studentIds}</p>}
              <p className="text-xs text-slate-500">Showing up to 20 matches. Refine your search to find more students.</p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
