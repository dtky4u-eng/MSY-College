"use client";
import { useState } from "react";
import { Banknote, Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { Alert } from "@/components/ui/page";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { SETTLEMENT_MODES, SETTLEMENT_MODE_LABEL } from "@/lib/constants";
import { formatINR, toISTDateString } from "@/lib/format";

const REF_REQUIRED = new Set<string>(["BANK_TRANSFER", "UPI", "CHEQUE"]);

export function RecordSettlementButton({
  college,
  size = "sm",
  variant = "primary",
}: {
  college: { id: string; name: string; pending: number; earned: number; received: number };
  size?: "xs" | "sm" | "md";
  variant?: "primary" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} icon={<Banknote className="size-4" />} onClick={() => setOpen(true)} disabled={college.pending <= 0} title={college.pending <= 0 ? "Nothing pending for this college" : undefined}>
        Record payment
      </Button>
      {open && <SettlementModal college={college} onClose={() => setOpen(false)} />}
    </>
  );
}

function SettlementModal({ college, onClose }: { college: { id: string; name: string; pending: number; earned: number; received: number }; onClose: () => void }) {
  const today = toISTDateString();
  const { run, loading, fields } = useAction();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<string>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(today);
  const [remarks, setRemarks] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const maxRupees = college.pending / 100;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const n = Number(amount);
    if (!amount.trim() || !Number.isFinite(n) || n <= 0) next.amount = "Enter an amount greater than zero";
    else if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) next.amount = "Use at most two decimal places";
    else if (Math.round(n * 100) > college.pending) next.amount = `Maximum ${formatINR(college.pending)}`;
    if (REF_REQUIRED.has(mode) && reference.trim().length < 4) next.reference = mode === "CHEQUE" ? "Enter the cheque number" : "Enter the UTR / transaction reference";
    if (!date) next.date = "Select the payment date";
    else if (date > today) next.date = "Payment date cannot be in the future";
    setErrs(next);
    if (Object.keys(next).length) return;
    const form = new FormData();
    form.set("collegeId", college.id);
    form.set("amount", amount.trim());
    form.set("mode", mode);
    form.set("reference", reference.trim());
    form.set("date", date);
    form.set("remarks", remarks.trim());
    if (proof) form.set("proof", proof);
    const ok = await run(() => api("/api/admin/settlements", { form }), { success: "Settlement recorded", successDescription: `${college.name} has been notified.`, refresh: true });
    if (ok) onClose();
  };
  const e = { ...fields, ...errs };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Record settlement payment"
      description={college.name}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="settlement-form" loading={loading}>
            Record payment
          </Button>
        </>
      }
    >
      <form id="settlement-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Earned share</p>
            <p className="font-semibold text-slate-900 tabular-nums">{formatINR(college.earned)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Received</p>
            <p className="font-semibold text-emerald-700 tabular-nums">{formatINR(college.received)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Pending</p>
            <p className="font-semibold text-amber-700 tabular-nums">{formatINR(college.pending)}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" htmlFor="st-amount" required error={e.amount} hint={`Up to ${formatINR(college.pending)}`}>
            <div className="flex gap-2">
              <Input id="st-amount" type="number" inputMode="decimal" min="0.01" max={maxRupees} step="0.01" value={amount} onChange={(ev) => setAmount(ev.target.value)} invalid={Boolean(e.amount)} />
              <Button variant="outline" size="md" onClick={() => setAmount(String(maxRupees))}>
                Full
              </Button>
            </div>
          </Field>
          <Field label="Payment mode" htmlFor="st-mode" required error={e.mode}>
            <Select id="st-mode" value={mode} onChange={(ev) => setMode(ev.target.value)}>
              {SETTLEMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {SETTLEMENT_MODE_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={mode === "CHEQUE" ? "Cheque number" : "UTR / reference"} htmlFor="st-ref" required={REF_REQUIRED.has(mode)} error={e.reference}>
            <Input id="st-ref" value={reference} onChange={(ev) => setReference(ev.target.value)} maxLength={80} invalid={Boolean(e.reference)} placeholder={mode === "CHEQUE" ? "e.g. 004512" : "e.g. SBIN526123456789"} />
          </Field>
          <Field label="Payment date" htmlFor="st-date" required error={e.date}>
            <Input id="st-date" type="date" max={today} value={date} onChange={(ev) => setDate(ev.target.value)} invalid={Boolean(e.date)} />
          </Field>
        </div>
        <Field label="Remarks" htmlFor="st-remarks" error={e.remarks}>
          <Textarea id="st-remarks" rows={2} value={remarks} onChange={(ev) => setRemarks(ev.target.value)} maxLength={500} placeholder="Optional — e.g. Settlement for August 2026 registrations" />
        </Field>
        <Field label="Payment proof" error={e.proof}>
          <FileInput accept=".pdf,.jpg,.jpeg,.png" maxBytes={5 * 1024 * 1024} value={proof} onChange={setProof} hint="PDF, JPG or PNG · max 5 MB (optional)" />
        </Field>
        <Alert tone="info" icon={<Info />}>
          The college admin is notified and the entry is recorded in the audit log. Settlements cannot exceed the pending balance.
        </Alert>
      </form>
    </Modal>
  );
}
