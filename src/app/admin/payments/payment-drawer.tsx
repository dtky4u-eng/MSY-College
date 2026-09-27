"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Pencil, Receipt, RefreshCw, Undo2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Alert, DetailList } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/badge";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { api, download } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, formatINR } from "@/lib/format";
import { JsonView } from "@/components/admin/ops/json-view";
import type { PaymentDetail } from "@/app/api/admin/payments/_shared";
import { GATEWAY_LABEL } from "./labels";

const METHODS = [
  { value: "", label: "Keep current / not specified" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "netbanking", label: "Net banking" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
];

const REASON_MIN = 10;
type Mode = "view" | "markPaid" | "edit" | "refund";

export function PaymentDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const receipt = useAction();
  const reconcile = useAction();

  const load = useCallback(async (pid: string) => {
    setLoadError(null);
    try {
      setDetail(await api<PaymentDetail>(`/api/admin/payments/${pid}`));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the payment");
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    setMode("view");
    if (id) load(id);
  }, [id, load]);

  const afterChange = async () => {
    setMode("view");
    if (id) await load(id);
    router.refresh();
  };

  if (!id) return null;
  const p = detail?.payment;
  const s = detail?.student;
  const canReconcile = p && ["CREATED", "PENDING", "VERIFY_FAILED"].includes(p.status);
  const canMarkPaid = canReconcile;
  const canEdit = p?.status === "CREATED";
  const isSuccess = p?.status === "SUCCESS";

  const generateReceipt = async () => {
    const res = await receipt.run(() => api<{ receiptNo: string; downloadUrl: string; regenerated: boolean }>(`/api/admin/payments/${id}/receipt`, { method: "POST" }), {
      success: p?.receiptNo ? "Receipt regenerated" : "Receipt generated",
    });
    if (res) {
      download(res.downloadUrl);
      await afterChange();
    }
  };

  const doReconcile = async () => {
    const res = await reconcile.run(() => api<{ status: string; changed: boolean; message: string }>(`/api/admin/payments/${id}/reconcile`, { method: "POST" }));
    if (res) {
      if (res.changed) toast.success("Payment reconciled", res.message);
      else toast.error("No change from the gateway", res.message);
      await afterChange();
    }
  };

  return (
    <>
      <Modal
        open={mode === "view"}
        onClose={onClose}
        size="xl"
        title={p ? `Payment ${p.transactionId}` : "Payment details"}
        description={s ? `${s.name} · ${s.registrationNumber}` : undefined}
        footer={
          p ? (
            <>
              {isSuccess && (
                <>
                  <Button variant="outline" icon={<Undo2 className="size-4" />} onClick={() => setMode("refund")} className="sm:mr-auto">
                    Record refund
                  </Button>
                  {p.receiptNo && (
                    <Button variant="outline" icon={<Download className="size-4" />} onClick={() => download(`/api/payments/${p.id}/receipt`)}>
                      Download receipt
                    </Button>
                  )}
                  <Button icon={<Receipt className="size-4" />} loading={receipt.loading} onClick={generateReceipt}>
                    {p.receiptNo ? "Regenerate receipt" : "Generate receipt"}
                  </Button>
                </>
              )}
              {canEdit && (
                <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setMode("edit")} className="sm:mr-auto">
                  Edit
                </Button>
              )}
              {canReconcile && (
                <Button variant="outline" icon={<RefreshCw className="size-4" />} loading={reconcile.loading} onClick={doReconcile}>
                  Reconcile with gateway
                </Button>
              )}
              {canMarkPaid && (
                <Button variant="success" icon={<CheckCircle2 className="size-4" />} onClick={() => setMode("markPaid")}>
                  Mark paid
                </Button>
              )}
              {!isSuccess && !canReconcile && (
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {loadError ? (
          <Alert tone="error" title="Could not load this payment" action={<Button size="sm" variant="outline" onClick={() => load(id)}>Retry</Button>}>
            {loadError}
          </Alert>
        ) : !p || !s ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading payment">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Amount</p>
                <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">{formatINR(p.amount)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={p.status} />
                <span className="text-xs text-slate-500">
                  {GATEWAY_LABEL[p.gateway] ?? p.gateway}
                  {p.method ? ` · ${p.method.toUpperCase()}` : ""}
                </span>
              </div>
            </div>

            {p.failureReason && (
              <Alert tone={p.status === "REFUNDED" ? "info" : "error"} icon={<AlertTriangle />} title={p.status === "REFUNDED" ? "Refund note" : "Failure reason"}>
                {p.failureReason}
              </Alert>
            )}
            {detail.otherSuccessTxn && !isSuccess && (
              <Alert tone="warning" icon={<AlertTriangle />} title="Student already paid">
                This student has another successful payment ({detail.otherSuccessTxn}). Do not mark this attempt as paid.
              </Alert>
            )}
            {p.manualReason && (
              <Alert tone="info" title={`Marked paid manually${p.markedBy ? ` by ${p.markedBy}` : ""}`}>
                {p.manualReason}
              </Alert>
            )}

            <section>
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Student</h4>
              <DetailList
                cols={3}
                items={[
                  [
                    "Name",
                    <Link key="n" href={`/admin/students/${s.id}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                      {s.name} <ExternalLink className="size-3" />
                    </Link>,
                  ],
                  ["University reg. no.", s.registrationNumber],
                  ["MSY College reg. no.", s.portalRegNo ?? "Not issued"],
                  ["College", s.college],
                  ["Domain", s.domain ?? "—"],
                  ["Registration payment", <StatusBadge key="ps" status={s.paymentStatus} />],
                  ["Email", s.email ?? "—"],
                  ["Mobile", s.mobile ?? "—"],
                  ["Fee on record", s.feeAmount ? formatINR(s.feeAmount) : "—"],
                ]}
              />
            </section>

            <section>
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Gateway identifiers</h4>
              <DetailList
                cols={2}
                items={[
                  ["Transaction ID", <Mono key="t">{p.transactionId}</Mono>],
                  ["Order ID", <Mono key="o">{p.orderId}</Mono>],
                  ["Gateway payment ID", <Mono key="g">{p.gatewayPaymentId}</Mono>],
                  ["Signature", <Mono key="s">{p.gatewaySignature}</Mono>],
                  ["Method", p.method ? p.method.toUpperCase() : "—"],
                  ["Currency", p.currency],
                ]}
              />
            </section>

            <section>
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Timeline</h4>
              <DetailList
                cols={3}
                items={[
                  ["Created", formatDateTime(p.createdAt)],
                  ["Last updated", formatDateTime(p.updatedAt)],
                  ["Paid at", formatDateTime(p.paidAt)],
                  ["Receipt number", p.receiptNo ?? "—"],
                  ["Receipt generated", formatDateTime(p.receiptGeneratedAt)],
                  ["Marked by", p.markedBy ?? "—"],
                ]}
              />
            </section>

            <details className="group rounded-xl border border-slate-200">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900 select-none group-open:border-b group-open:border-slate-100">
                Raw gateway payload
              </summary>
              <div className="p-3">
                <JsonView value={p.raw} emptyLabel="No gateway payload stored for this payment." />
              </div>
            </details>

            <section>
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Admin activity</h4>
              {detail.history.length === 0 ? (
                <p className="text-sm text-slate-500">No admin actions have been recorded for this payment.</p>
              ) : (
                <ol className="space-y-2">
                  {detail.history.map((h) => (
                    <li key={h.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-800">{h.action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>
                        <span className="text-xs text-slate-500">
                          {h.actor} · {formatDateTime(h.at)}
                        </span>
                      </div>
                      <HistoryReason details={h.details} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </Modal>

      {p && mode === "markPaid" && <MarkPaidModal payment={p} onClose={() => setMode("view")} onDone={afterChange} />}
      {p && mode === "edit" && <EditModal payment={p} onClose={() => setMode("view")} onDone={afterChange} />}
      {p && mode === "refund" && <RefundModal payment={p} onClose={() => setMode("view")} onDone={afterChange} />}
    </>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  if (!children) return <span className="text-slate-400">—</span>;
  return <span className="font-mono text-xs break-all text-slate-800">{children}</span>;
}

function HistoryReason({ details }: { details: string }) {
  let d: Record<string, unknown> = {};
  try {
    d = JSON.parse(details);
  } catch {
    return null;
  }
  const parts: string[] = [];
  if (typeof d.operation === "string") parts.push(d.operation === "RECONCILE" ? `Reconciled (${String(d.previousStatus ?? "")} → ${String(d.newStatus ?? d.error ?? "")})` : d.operation);
  if (typeof d.reason === "string") parts.push(d.reason);
  if (typeof d.receiptNo === "string") parts.push(`Receipt ${d.receiptNo}${d.regenerated ? " (regenerated)" : ""}`);
  if (!parts.length) return null;
  return <p className="mt-1 text-xs text-slate-600">{parts.join(" · ")}</p>;
}

type P = PaymentDetail["payment"];

function MarkPaidModal({ payment, onClose, onDone }: { payment: P; onClose: () => void; onDone: () => void }) {
  const { run, loading, fields } = useAction();
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < REASON_MIN) return setErr(`Reason must be at least ${REASON_MIN} characters`);
    setErr(null);
    const ok = await run(() => api(`/api/admin/payments/${payment.id}/mark-paid`, { body: { reason, method: method || null, reference: reference || null } }), {
      success: "Payment marked as paid",
      successDescription: "The student's account is now active and a receipt has been issued.",
    });
    if (ok) onDone();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Mark payment as paid"
      description={`${payment.transactionId} · ${formatINR(payment.amount)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Back
          </Button>
          <Button variant="success" type="submit" form="mark-paid-form" loading={loading}>
            Confirm mark paid
          </Button>
        </>
      }
    >
      <form id="mark-paid-form" onSubmit={submit} className="space-y-4" noValidate>
        <Alert tone="warning" icon={<AlertTriangle />}>
          Use this only after confirming the money has been received (bank statement or gateway dashboard). The student will be activated, a receipt number issued and this action is recorded in the audit log.
        </Alert>
        <Field label="Reason" htmlFor="mp-reason" required error={err ?? fields.reason} hint={`${reason.trim().length}/${REASON_MIN} characters minimum`}>
          <Textarea id="mp-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} invalid={Boolean(err ?? fields.reason)} placeholder="e.g. Amount credited to bank account on 24 Sep, confirmed with statement" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment method" htmlFor="mp-method" error={fields.method}>
            <Select id="mp-method" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference (UTR / bank ref.)" htmlFor="mp-ref" error={fields.reference}>
            <Input id="mp-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} placeholder="Optional" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function EditModal({ payment, onClose, onDone }: { payment: P; onClose: () => void; onDone: () => void }) {
  const { run, loading, fields } = useAction();
  const [amount, setAmount] = useState(String(payment.amount / 100));
  const [method, setMethod] = useState(payment.method ?? "");
  const [reason, setReason] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) next.amount = "Enter an amount greater than zero";
    else if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) next.amount = "Use at most two decimal places";
    if (reason.trim().length < REASON_MIN) next.reason = `Reason must be at least ${REASON_MIN} characters`;
    setErrs(next);
    if (Object.keys(next).length) return;
    const ok = await run(() => api(`/api/admin/payments/${payment.id}`, { method: "PATCH", body: { amount: n, method: method || null, reason } }), { success: "Payment updated" });
    if (ok) onDone();
  };
  const e = { ...fields, ...errs };
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit payment"
      description="Only payments that have not been attempted yet (Created) can be edited."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Back
          </Button>
          <Button type="submit" form="edit-payment-form" loading={loading}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-payment-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" htmlFor="ep-amount" required error={e.amount} hint="Changing the amount also updates the student's fee on record.">
            <Input id="ep-amount" type="number" inputMode="decimal" min="1" step="0.01" value={amount} onChange={(ev) => setAmount(ev.target.value)} invalid={Boolean(e.amount)} />
          </Field>
          <Field label="Method" htmlFor="ep-method" error={e.method}>
            <Select id="ep-method" value={method} onChange={(ev) => setMethod(ev.target.value)}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.value ? m.label : "Not specified"}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Reason for the change" htmlFor="ep-reason" required error={e.reason} hint={`${reason.trim().length}/${REASON_MIN} characters minimum`}>
          <Textarea id="ep-reason" rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} invalid={Boolean(e.reason)} placeholder="e.g. Fee revised after college fee update" />
        </Field>
      </form>
    </Modal>
  );
}

function RefundModal({ payment, onClose, onDone }: { payment: P; onClose: () => void; onDone: () => void }) {
  const { run, loading, fields } = useAction();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (reason.trim().length < REASON_MIN) next.reason = `Reason must be at least ${REASON_MIN} characters`;
    if (confirm.trim() !== payment.transactionId) next.confirm = "Type the exact transaction ID to confirm";
    setErrs(next);
    if (Object.keys(next).length) return;
    const ok = await run(() => api(`/api/admin/payments/${payment.id}/refund`, { body: { reason, confirm: confirm.trim() } }), {
      success: "Refund recorded",
      successDescription: "The registration is now unpaid and the student's login has been deactivated.",
    });
    if (ok) onDone();
  };
  const e = { ...fields, ...errs };
  return (
    <Modal
      open
      onClose={onClose}
      title="Record a refund"
      description={`${payment.transactionId} · ${formatINR(payment.amount)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Back
          </Button>
          <Button variant="danger" type="submit" form="refund-form" loading={loading} disabled={confirm.trim() !== payment.transactionId}>
            Record refund
          </Button>
        </>
      }
    >
      <form id="refund-form" onSubmit={submit} className="space-y-4" noValidate>
        <Alert tone="error" icon={<AlertTriangle />} title="This cannot be undone from the portal">
          This only records the refund. Process the actual refund from the {GATEWAY_LABEL[payment.gateway] ?? payment.gateway} dashboard first. The payment becomes Refunded, the student&apos;s registration becomes unpaid and their login is deactivated.
        </Alert>
        <Field label="Reason" htmlFor="rf-reason" required error={e.reason} hint={`${reason.trim().length}/${REASON_MIN} characters minimum`}>
          <Textarea id="rf-reason" rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} invalid={Boolean(e.reason)} placeholder="e.g. Student withdrew before the internship start; gateway refund ID rfnd_..." />
        </Field>
        <Field
          label={
            <>
              Type <span className="font-mono text-rose-700">{payment.transactionId}</span> to confirm
            </>
          }
          htmlFor="rf-confirm"
          required
          error={e.confirm}
        >
          <Input id="rf-confirm" value={confirm} onChange={(ev) => setConfirm(ev.target.value)} autoComplete="off" invalid={Boolean(e.confirm)} />
        </Field>
      </form>
    </Modal>
  );
}
