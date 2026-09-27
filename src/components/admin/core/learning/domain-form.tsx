"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IndianRupee, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { paiseToRupees } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/page";
import { checkFields, domainSchema } from "./schemas";
import { learningHref } from "./shared";
import type { DomainValue, SectorOption } from "./types";

interface FormState {
  code: string;
  name: string;
  description: string;
  sectorId: string;
  durationHours: string;
  defaultFee: string;
  active: boolean;
  featured: boolean;
}

function initial(domain: DomainValue | undefined, sectors: SectorOption[], defaultSectorId?: string | null): FormState {
  if (domain) {
    return {
      code: domain.code,
      name: domain.name,
      description: domain.description ?? "",
      sectorId: domain.sectorId,
      durationHours: String(domain.durationHours),
      defaultFee: String(paiseToRupees(domain.defaultFee)),
      active: domain.active,
      featured: domain.featured,
    };
  }
  const sectorId = defaultSectorId && sectors.some((s) => s.id === defaultSectorId) ? defaultSectorId : sectors.length === 1 ? sectors[0]!.id : "";
  return { code: "", name: "", description: "", sectorId, durationHours: "120", defaultFee: "", active: true, featured: false };
}

/** Create / edit domain dialog (FR-ADM-8). */
export function DomainFormButton({
  sectors,
  domain,
  defaultSectorId,
  size = "md",
  variant,
}: {
  sectors: SectorOption[];
  domain?: DomainValue;
  defaultSectorId?: string | null;
  size?: "sm" | "md";
  variant?: "primary" | "outline";
}) {
  const editing = Boolean(domain);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<FormState>(() => initial(domain, sectors, defaultSectorId));
  const [local, setLocal] = useState<Record<string, string>>({});
  const { run, loading, fields, setFields } = useAction();
  const router = useRouter();
  const err = (k: keyof FormState) => local[k] ?? fields[k];

  const set = <K extends keyof FormState>(k: K, value: FormState[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    setLocal((s) => {
      const next = { ...s };
      delete next[k];
      return next;
    });
  };

  const openForm = () => {
    setV(initial(domain, sectors, defaultSectorId));
    setLocal({});
    setFields({});
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = checkFields(domainSchema, v);
    setLocal(errs);
    if (Object.keys(errs).length) return;
    const res = await run(
      () =>
        editing
          ? api<{ id: string }>(`/api/admin/learning/domains/${domain!.id}`, { method: "PATCH", body: v })
          : api<{ id: string }>("/api/admin/learning/domains", { body: v }),
      { success: editing ? "Domain updated" : "Domain created", refresh: editing },
    );
    if (!res) return;
    setOpen(false);
    if (!editing) router.push(learningHref({ domain: res.id }));
  };

  return (
    <>
      {editing ? (
        <Button variant={variant ?? "outline"} size={size} icon={<Pencil className="size-4" />} onClick={openForm}>
          Edit
        </Button>
      ) : (
        <Button variant={variant ?? "primary"} size={size} icon={<Plus className="size-4" />} onClick={openForm}>
          New domain
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title={editing ? `Edit ${domain!.name}` : "New domain"}
        description={editing ? "Update the domain details shown to colleges and students." : "Domains are the internship tracks students register for."}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="domain-form" loading={loading} disabled={!sectors.length}>
              {editing ? "Save changes" : "Create domain"}
            </Button>
          </>
        }
      >
        {!sectors.length ? (
          <Alert tone="warning" title="Create a sector first">
            Every domain belongs to a sector. Use “Manage sectors” to add one.
          </Alert>
        ) : (
          <form id="domain-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
            <Field label="Domain name" htmlFor="d-name" required error={err("name")} className="sm:col-span-2">
              <Input id="d-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} placeholder="e.g. Web Development" invalid={Boolean(err("name"))} />
            </Field>
            <Field label="Domain code" htmlFor="d-code" required error={err("code")} hint="Uppercase letters, digits and dashes. Must be unique.">
              <Input
                id="d-code"
                value={v.code}
                onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s+/g, "-"))}
                maxLength={16}
                placeholder="e.g. WEB"
                className="font-mono uppercase"
                invalid={Boolean(err("code"))}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </Field>
            <Field label="Sector" htmlFor="d-sector" required error={err("sectorId")}>
              <Select id="d-sector" value={v.sectorId} onChange={(e) => set("sectorId", e.target.value)} invalid={Boolean(err("sectorId"))}>
                <option value="">Choose a sector</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duration (hours)" htmlFor="d-hours" required error={err("durationHours")}>
              <Input id="d-hours" type="number" inputMode="numeric" min={1} step={1} value={v.durationHours} onChange={(e) => set("durationHours", e.target.value)} invalid={Boolean(err("durationHours"))} />
            </Field>
            <Field label="Default fee (₹)" htmlFor="d-fee" required error={err("defaultFee")} hint="Colleges can override this with a custom fee.">
              <Input
                id="d-fee"
                type="number"
                inputMode="decimal"
                min={1}
                step="0.01"
                value={v.defaultFee}
                onChange={(e) => set("defaultFee", e.target.value)}
                placeholder="e.g. 1499"
                leading={<IndianRupee className="size-4" />}
                invalid={Boolean(err("defaultFee"))}
              />
            </Field>
            <Field label="Description" htmlFor="d-desc" error={err("description")} className="sm:col-span-2">
              <Textarea id="d-desc" rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} placeholder="What students will learn in this domain" invalid={Boolean(err("description"))} />
            </Field>
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:col-span-2">
              <Switch checked={v.active} onChange={(x) => set("active", x)} label={<span><b className="font-medium text-slate-900">Active</b> — open for new registrations</span>} />
              <Switch checked={v.featured} onChange={(x) => set("featured", x)} label={<span><b className="font-medium text-slate-900">Featured</b> — highlighted on the domain selection screen</span>} />
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
