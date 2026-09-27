"use client";
import { useState } from "react";
import { Check, FolderTree, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { checkFields, sectorSchema } from "./schemas";
import { plural } from "./shared";
import type { SectorOption } from "./types";

/** "Manage sectors" dialog: add, rename and delete sectors (sectors with domains are protected). */
export function SectorManager({ sectors }: { sectors: SectorOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" icon={<FolderTree className="size-4" />} onClick={() => setOpen(true)}>
        Manage sectors
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Sectors" description="Sectors group related domains, e.g. Information Technology or Agriculture." size="md">
        <div className="space-y-5">
          <AddSector />
          {sectors.length === 0 ? (
            <EmptyState icon={<FolderTree />} title="No sectors yet" description="Add your first sector above, then create domains inside it." className="py-8" />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {sectors.map((s) => (
                <SectorRow key={s.id} sector={s} />
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}

function AddSector() {
  const [name, setName] = useState("");
  const [local, setLocal] = useState<Record<string, string>>({});
  const { run, loading, fields } = useAction();
  const err = local.name ?? fields.name;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = checkFields(sectorSchema, { name });
    setLocal(errs);
    if (Object.keys(errs).length) return;
    const res = await run(() => api("/api/admin/learning/sectors", { body: { name } }), { success: "Sector added", refresh: true });
    if (res) setName("");
  };

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="new-sector" className="mb-1.5 block text-sm font-medium text-slate-700">
        New sector
      </label>
      <div className="flex gap-2">
        <Input
          id="new-sector"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setLocal({});
          }}
          placeholder="e.g. Information Technology"
          maxLength={80}
          invalid={Boolean(err)}
          aria-invalid={Boolean(err)}
          aria-describedby={err ? "new-sector-error" : undefined}
        />
        <Button type="submit" loading={loading} icon={<Plus className="size-4" />}>
          Add
        </Button>
      </div>
      {err && (
        <p id="new-sector-error" className="mt-1 text-xs font-medium text-rose-600">
          {err}
        </p>
      )}
    </form>
  );
}

function SectorRow({ sector }: { sector: SectorOption }) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [name, setName] = useState(sector.name);
  const [local, setLocal] = useState<string | null>(null);
  const save = useAction();
  const del = useAction();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = checkFields(sectorSchema, { name });
    setLocal(errs.name ?? null);
    if (errs.name) return;
    const res = await save.run(() => api(`/api/admin/learning/sectors/${sector.id}`, { method: "PATCH", body: { name } }), { success: "Sector renamed", refresh: true });
    if (res) setMode("view");
  };

  const remove = async () => {
    const res = await del.run(() => api(`/api/admin/learning/sectors/${sector.id}`, { method: "DELETE" }), { success: "Sector deleted", refresh: true, silentError: true });
    if (res) setMode("view");
  };

  if (mode === "edit") {
    const err = local ?? save.fields.name;
    return (
      <li className="px-3 py-3">
        <form onSubmit={submit} noValidate className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setLocal(null);
            }}
            maxLength={80}
            autoFocus
            aria-label="Sector name"
            invalid={Boolean(err)}
          />
          <Button type="submit" size="sm" loading={save.loading} icon={<Check className="size-4" />} aria-label="Save sector name" />
          <Button
            size="sm"
            variant="ghost"
            icon={<X className="size-4" />}
            aria-label="Cancel"
            onClick={() => {
              setMode("view");
              setName(sector.name);
              setLocal(null);
            }}
          />
        </form>
        {err && <p className="mt-1 text-xs font-medium text-rose-600">{err}</p>}
      </li>
    );
  }

  return (
    <li className="px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{sector.name}</p>
          <p className="text-xs text-slate-500">{plural(sector.domains, "domain")}</p>
        </div>
        {mode === "delete" ? (
          <div className="flex items-center gap-1.5">
            <span className="hidden text-xs text-slate-600 sm:inline">Delete this sector?</span>
            <Button size="xs" variant="outline" onClick={() => setMode("view")} disabled={del.loading}>
              Cancel
            </Button>
            <Button size="xs" variant="danger" onClick={remove} loading={del.loading}>
              Delete
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {sector.domains > 0 && <Badge tone="gray">In use</Badge>}
            <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} aria-label={`Rename ${sector.name}`} title="Rename" onClick={() => setMode("edit")} />
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              icon={<Trash2 className="size-4" />}
              aria-label={`Delete ${sector.name}`}
              title="Delete"
              onClick={() => {
                del.setError(null);
                setMode("delete");
              }}
            />
          </div>
        )}
      </div>
      {mode === "delete" && del.error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{del.error}</p>}
    </li>
  );
}
