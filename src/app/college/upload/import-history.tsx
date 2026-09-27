"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { WarningsTable } from "./import-form";

export interface ImportRow {
  id: string;
  fileName: string;
  totalRows: number;
  imported: number;
  skipped: number;
  createdAt: string;
  warnings: { row: number; message: string }[];
}

export function ImportHistory({ rows }: { rows: ImportRow[] }) {
  const [open, setOpen] = useState<ImportRow | null>(null);
  return (
    <>
      <Table>
        <THead>
          <tr>
            <TH>Uploaded</TH>
            <TH>File</TH>
            <TH className="text-right">Rows</TH>
            <TH className="text-right">Imported / updated</TH>
            <TH className="text-right">Skipped</TH>
            <TH>Warnings</TH>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && <EmptyRow colSpan={6}>No uploads yet. Your import history will appear here.</EmptyRow>}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="whitespace-nowrap text-slate-500">{r.createdAt}</TD>
              <TD className="max-w-64 truncate font-medium text-slate-900" title={r.fileName}>{r.fileName}</TD>
              <TD className="text-right tabular-nums">{r.totalRows}</TD>
              <TD className="text-right tabular-nums text-emerald-700">{r.imported}</TD>
              <TD className="text-right tabular-nums">{r.skipped ? <span className="text-rose-600">{r.skipped}</span> : 0}</TD>
              <TD>
                {r.warnings.length ? (
                  <Button size="xs" variant="outline" icon={<AlertTriangle className="size-3.5 text-amber-500" />} onClick={() => setOpen(r)}>
                    {r.warnings.length} warning{r.warnings.length === 1 ? "" : "s"}
                  </Button>
                ) : (
                  <Badge tone="green">None</Badge>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title="Import warnings" description={open ? `${open.fileName} · ${open.createdAt}` : undefined} size="lg">
        {open && <WarningsTable warnings={open.warnings} />}
      </Modal>
    </>
  );
}
