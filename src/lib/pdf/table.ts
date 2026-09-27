// Generic tabular PDF export for reports (FR-ADM-14).
import "server-only";
import { formatDateTime } from "../format";
import { COLORS, PdfKit } from "./kit";

export interface ExportColumn {
  key: string;
  header: string;
  width?: number; // relative weight
  align?: "left" | "center" | "right";
}

export async function rowsToPdf(title: string, columns: ExportColumn[], rows: Record<string, unknown>[], subtitle?: string): Promise<Uint8Array> {
  const k = await PdfKit.create({ landscape: columns.length > 6, title });
  k.letterhead(title);
  k.setRunningHeader(title);
  if (subtitle) k.text(subtitle, { size: 9, color: COLORS.muted, align: "center" });
  k.text(`Generated ${formatDateTime(new Date())}  •  ${rows.length} record(s)`, { size: 8.5, color: COLORS.muted, align: "center" });
  k.space(6);
  const total = columns.reduce((a, c) => a + (c.width ?? 1), 0);
  k.table(
    columns.map((c) => ({ header: c.header, width: (c.width ?? 1) / total, align: c.align })),
    rows.map((r) => columns.map((c) => (r[c.key] as string | number | null | undefined) ?? "—")),
    { size: columns.length > 8 ? 7.5 : 8.5 },
  );
  return k.save();
}
