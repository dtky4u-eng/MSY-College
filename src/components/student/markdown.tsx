// Small, SAFE markdown renderer for chapter notes. It never injects HTML: the source is parsed into
// React elements and every piece of text is rendered as a string (React escapes it).
// Supported: # headings, - / * / + bullet lists, 1. ordered lists, **bold**, *italic* / _italic_,
// `inline code`, ``` fenced code blocks ```, [links](https://…) (http/https only), paragraphs, --- rules.
import { Fragment, type ReactNode } from "react";

type Block =
  | { type: "h"; level: number; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[]; start: number }
  | { type: "code"; lang: string; code: string }
  | { type: "hr" }
  | { type: "quote"; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fence = line.match(/^\s*```\s*([\w+-]*)\s*$/);
    if (fence) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i]!)) code.push(lines[i++]!);
      blocks.push({ type: "code", lang: fence[1] ?? "", code: code.join("\n") });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      flush();
      blocks.push({ type: "h", level: h[1]!.length, text: h[2]! });
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      blocks.push({ type: "hr" });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*[-*+]\s+/, ""));
      i--;
      blocks.push({ type: "ul", items });
      continue;
    }
    const ol = line.match(/^\s*(\d{1,6})[.)]\s+/);
    if (ol) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d{1,6}[.)]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*\d{1,6}[.)]\s+/, ""));
      i--;
      blocks.push({ type: "ol", items, start: Number(ol[1]) || 1 });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flush();
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]!)) q.push(lines[i++]!.replace(/^\s*>\s?/, ""));
      i--;
      blocks.push({ type: "quote", text: q.join(" ") });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+?\*\*)|(__[^_]+?__)|(\*[^*\s](?:[^*]*[^*\s])?\*)|(\b_[^_\s](?:[^_]*[^_\s])?_\b)|(\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string, key: string, allowCode = true): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0];
    const k = `${key}-${n++}`;
    if (m[1]) out.push(allowCode ? <code key={k}>{tok.slice(1, -1)}</code> : tok);
    else if (m[2] || m[3]) out.push(<strong key={k}>{inline(tok.slice(2, -2), k, allowCode)}</strong>);
    else if (m[4] || m[5]) out.push(<em key={k}>{inline(tok.slice(1, -1), k, allowCode)}</em>);
    else if (m[6]) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const href = lm?.[2] ?? "";
      if (lm && /^https?:\/\//i.test(href))
        out.push(
          <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700">
            {lm[1]}
          </a>,
        );
      else out.push(lm?.[1] ?? tok);
    }
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source ?? "");
  return (
    <div className={["prose-notes text-[15px]", className].filter(Boolean).join(" ")}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.type) {
          case "h": {
            const content = inline(b.text, k);
            if (b.level === 1) return <h1 key={k}>{content}</h1>;
            if (b.level === 2) return <h2 key={k}>{content}</h2>;
            if (b.level === 3) return <h3 key={k}>{content}</h3>;
            return (
              <h4 key={k} className="mt-3 mb-1 font-semibold text-slate-900">
                {content}
              </h4>
            );
          }
          case "p":
            return <p key={k}>{inline(b.text, k)}</p>;
          case "ul":
            return (
              <ul key={k}>
                {b.items.map((it, j) => (
                  <li key={j} className="my-0.5">
                    {inline(it, `${k}-${j}`)}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={k} start={b.start}>
                {b.items.map((it, j) => (
                  <li key={j} className="my-0.5">
                    {inline(it, `${k}-${j}`)}
                  </li>
                ))}
              </ol>
            );
          case "code":
            return (
              <pre key={k} data-lang={b.lang || undefined}>
                <code className="!bg-transparent !p-0">{b.code}</code>
              </pre>
            );
          case "quote":
            return (
              <blockquote key={k} className="my-3 border-l-4 border-brand-200 bg-brand-50/40 py-1.5 pl-4 text-slate-700 italic">
                {inline(b.text, k)}
              </blockquote>
            );
          case "hr":
            return <hr key={k} className="my-4 border-slate-200" />;
          default:
            return <Fragment key={k} />;
        }
      })}
    </div>
  );
}
