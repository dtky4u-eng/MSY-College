// Tiny layout toolkit on top of pdf-lib: wrapped text, key/value grids and paginated tables.
import "server-only";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { ORG } from "../constants";

export const COLORS = {
  brand: rgb(0.263, 0.22, 0.792), // indigo-700
  brandLight: rgb(0.933, 0.937, 1),
  ink: rgb(0.09, 0.11, 0.16),
  muted: rgb(0.39, 0.43, 0.51),
  line: rgb(0.86, 0.88, 0.92),
  zebra: rgb(0.972, 0.976, 0.988),
  gold: rgb(0.72, 0.53, 0.04),
  green: rgb(0.02, 0.5, 0.33),
  white: rgb(1, 1, 1),
};

/** Standard fonts are WinAnsi-only: normalise text so rendering never throws. */
export function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/₹/g, "Rs. ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .replace(/[→]/g, "->")
    .replace(/[\t\r]/g, " ")
    .replace(/[^\x0A\x20-\x7E\xA0-\xFF–—•…]/g, "");
}

export interface TextOpts {
  size?: number;
  font?: "regular" | "bold" | "italic";
  color?: RGB;
  x?: number;
  maxWidth?: number;
  align?: "left" | "center" | "right";
  lineGap?: number;
}

export interface Column {
  header: string;
  width: number; // fraction of content width
  align?: "left" | "center" | "right";
}

export class PdfKit {
  doc!: PDFDocument;
  page!: PDFPage;
  font!: PDFFont;
  bold!: PDFFont;
  italic!: PDFFont;
  y = 0;
  margin = 48;
  pageW = 595.28;
  pageH = 841.89;
  private headerTitle = "";

  static async create(opts: { landscape?: boolean; title?: string } = {}) {
    const k = new PdfKit();
    k.doc = await PDFDocument.create();
    k.doc.setTitle(opts.title ?? ORG.brand);
    k.doc.setAuthor(ORG.name);
    k.doc.setCreator("MSY College ERP");
    k.font = await k.doc.embedFont(StandardFonts.Helvetica);
    k.bold = await k.doc.embedFont(StandardFonts.HelveticaBold);
    k.italic = await k.doc.embedFont(StandardFonts.HelveticaOblique);
    if (opts.landscape) [k.pageW, k.pageH] = [841.89, 595.28];
    k.addPage();
    return k;
  }

  get contentW() {
    return this.pageW - this.margin * 2;
  }

  addPage() {
    this.page = this.doc.addPage([this.pageW, this.pageH]);
    this.y = this.pageH - this.margin;
    if (this.headerTitle) this.runningHeader();
  }

  private f(kind: TextOpts["font"]) {
    return kind === "bold" ? this.bold : kind === "italic" ? this.italic : this.font;
  }

  ensure(h: number) {
    if (this.y - h < this.margin + 24) this.addPage();
  }

  wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const out: string[] = [];
    for (const para of clean(text).split("\n")) {
      const words = para.split(/\s+/);
      let line = "";
      for (const w of words) {
        const trial = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(trial, size) <= maxWidth) line = trial;
        else {
          if (line) out.push(line);
          // hard-break very long words
          let word = w;
          while (font.widthOfTextAtSize(word, size) > maxWidth && word.length > 1) {
            let i = word.length;
            while (i > 1 && font.widthOfTextAtSize(word.slice(0, i), size) > maxWidth) i--;
            out.push(word.slice(0, i));
            word = word.slice(i);
          }
          line = word;
        }
      }
      out.push(line);
    }
    return out;
  }

  text(str: string, o: TextOpts = {}) {
    const size = o.size ?? 10.5;
    const font = this.f(o.font);
    const x0 = o.x ?? this.margin;
    const maxW = o.maxWidth ?? this.pageW - this.margin - x0;
    const lh = size * 1.35 + (o.lineGap ?? 0);
    for (const line of this.wrap(str, font, size, maxW)) {
      this.ensure(lh);
      const w = font.widthOfTextAtSize(line, size);
      const x = o.align === "center" ? x0 + (maxW - w) / 2 : o.align === "right" ? x0 + maxW - w : x0;
      this.page.drawText(line, { x, y: this.y - size, size, font, color: o.color ?? COLORS.ink });
      this.y -= lh;
    }
  }

  /** Draw text at an absolute position without moving the cursor. */
  at(str: string, x: number, y: number, o: Omit<TextOpts, "x" | "maxWidth" | "lineGap"> & { width?: number } = {}) {
    const size = o.size ?? 10;
    const font = this.f(o.font);
    const s = clean(str);
    const w = font.widthOfTextAtSize(s, size);
    const dx = o.width ? (o.align === "center" ? (o.width - w) / 2 : o.align === "right" ? o.width - w : 0) : 0;
    this.page.drawText(s, { x: x + dx, y, size, font, color: o.color ?? COLORS.ink });
  }

  space(h = 10) {
    this.y -= h;
  }

  rule(color = COLORS.line) {
    this.ensure(8);
    this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: this.pageW - this.margin, y: this.y }, thickness: 0.8, color });
    this.y -= 8;
  }

  /** Letterhead: brand band + org details. */
  letterhead(docTitle?: string) {
    const h = 64;
    this.page.drawRectangle({ x: 0, y: this.pageH - h, width: this.pageW, height: h, color: COLORS.brand });
    this.at(ORG.brand, this.margin, this.pageH - 34, { size: 20, font: "bold", color: COLORS.white });
    this.at("NEP 2020 / CBCS Internship Programme  •  MSME Registered  •  ISO 9001:2015", this.margin, this.pageH - 50, { size: 8.5, color: rgb(0.85, 0.86, 1) });
    this.at(`${ORG.email}  |  ${ORG.phone}  |  ${ORG.website}`, this.margin, this.pageH - 32, {
      size: 8.5,
      color: rgb(0.85, 0.86, 1),
      width: this.contentW,
      align: "right",
    });
    this.y = this.pageH - h - 28;
    if (docTitle) {
      this.text(docTitle.toUpperCase(), { size: 15, font: "bold", color: COLORS.brand, align: "center" });
      this.space(6);
    }
  }

  /** Compact header repeated on continuation pages. */
  setRunningHeader(title: string) {
    this.headerTitle = title;
  }

  private runningHeader() {
    this.at(`${ORG.brand} — ${this.headerTitle}`, this.margin, this.pageH - 30, { size: 8.5, color: COLORS.muted });
    this.page.drawLine({ start: { x: this.margin, y: this.pageH - 36 }, end: { x: this.pageW - this.margin, y: this.pageH - 36 }, thickness: 0.6, color: COLORS.line });
    this.y = this.pageH - 52;
  }

  keyValues(pairs: [string, string | number | null | undefined][], cols = 2) {
    const colW = this.contentW / cols;
    const rowH = 30;
    for (let i = 0; i < pairs.length; i += cols) {
      this.ensure(rowH);
      for (let c = 0; c < cols; c++) {
        const p = pairs[i + c];
        if (!p) continue;
        const x = this.margin + c * colW;
        this.at(p[0].toUpperCase(), x, this.y - 8, { size: 7.5, font: "bold", color: COLORS.muted });
        const v = this.wrap(String(p[1] ?? "—") || "—", this.font, 10.5, colW - 12)[0] ?? "—";
        this.at(v, x, this.y - 22, { size: 10.5 });
      }
      this.y -= rowH;
    }
    this.space(4);
  }

  table(columns: Column[], rows: (string | number | null | undefined)[][], o: { size?: number; zebra?: boolean } = {}) {
    const size = o.size ?? 9;
    const pad = 5;
    const widths = columns.map((c) => c.width * this.contentW);
    const drawHeader = () => {
      const h = size + pad * 2 + 2;
      this.ensure(h + 16);
      this.page.drawRectangle({ x: this.margin, y: this.y - h, width: this.contentW, height: h, color: COLORS.brandLight });
      let x = this.margin;
      columns.forEach((c, i) => {
        this.at(c.header, x + pad, this.y - h + pad + 2, { size: size - 0.5, font: "bold", color: COLORS.brand, width: widths[i]! - pad * 2, align: c.align });
        x += widths[i]!;
      });
      this.y -= h;
    };
    drawHeader();
    rows.forEach((row, ri) => {
      const cells = row.map((v, i) => this.wrap(String(v ?? "—"), this.font, size, widths[i]! - pad * 2));
      const lines = Math.max(1, ...cells.map((c) => c.length));
      const h = lines * size * 1.3 + pad * 2;
      if (this.y - h < this.margin + 24) {
        this.addPage();
        drawHeader();
      }
      if (o.zebra !== false && ri % 2 === 1) this.page.drawRectangle({ x: this.margin, y: this.y - h, width: this.contentW, height: h, color: COLORS.zebra });
      let x = this.margin;
      cells.forEach((lns, i) => {
        lns.forEach((ln, li) => {
          this.at(ln, x + pad, this.y - pad - size - li * size * 1.3 + 1, { size, width: widths[i]! - pad * 2, align: columns[i]!.align });
        });
        x += widths[i]!;
      });
      this.y -= h;
      this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: this.pageW - this.margin, y: this.y }, thickness: 0.4, color: COLORS.line });
    });
    this.space(10);
  }

  signatures(labels: string[]) {
    this.ensure(70);
    this.space(36);
    const w = this.contentW / labels.length;
    labels.forEach((l, i) => {
      const x = this.margin + i * w + 10;
      this.page.drawLine({ start: { x, y: this.y }, end: { x: x + w - 40, y: this.y }, thickness: 0.8, color: COLORS.muted });
      this.at(l, x, this.y - 12, { size: 9, color: COLORS.muted });
    });
    this.space(24);
  }

  async save(footerNote?: string): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      const note = clean(footerNote ?? `${ORG.name}  •  Generated by MSY College ERP`);
      p.drawText(note, { x: this.margin, y: 22, size: 7.5, font: this.font, color: COLORS.muted });
      const pn = `Page ${i + 1} of ${pages.length}`;
      p.drawText(pn, { x: p.getWidth() - this.margin - this.font.widthOfTextAtSize(pn, 7.5), y: 22, size: 7.5, font: this.font, color: COLORS.muted });
    });
    return this.doc.save();
  }
}
