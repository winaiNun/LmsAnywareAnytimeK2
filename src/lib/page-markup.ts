/**
 * The tiny, safe markup used for page and lesson text (no HTML): blank line = new paragraph, "## " = heading,
 * "- " = list item, [text](https://...) = link (https, "/path", mailto: and tel: only). No database here, so the
 * editor can use it in the browser for a live preview.
 */
export type Inline = { text: string; href?: string };
export type Block =
  | { type: "h"; text: string }
  | { type: "p"; inline: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "img"; key: string; alt: string }
  | { type: "drive"; id: string; thumbKey: string | null; title: string }
  | { type: "html"; code: string };

/**
 * Rich blocks, one directive per line (the editor's toolbar writes them; a pasted line works too):
 *   {{img content/<name>.webp | alt text}}                 an uploaded A4 picture (WebP made by the server)
 *   {{drive <fileId> | content/<name>.webp | title}}       a Google Drive file (PDF, image...) shown as a preview card
 *   {{html}} ...lines... {{/html}}                         pasted HTML, shown in a sandboxed frame (admin pages only)
 */
export const CONTENT_KEY_RE = /^content\/[A-Za-z0-9_-]{8,64}\.webp$/;
export const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;
export const MAX_PAGE_HTML_BYTES = 100 * 1024;
export const MAX_PAGE_HTML_BLOCKS = 3;

const clean = (t: string) => t.replace(/[|{}\r\n]/g, " ").replace(/ {2,}/g, " ").trim();
export const imgDirective = (key: string, alt: string) => `{{img ${key} | ${clean(alt)}}}`;
export const driveDirective = (id: string, thumbKey: string | null, title: string) => `{{drive ${id} | ${thumbKey ?? ""} | ${clean(title)}}}`;
export const htmlDirective = (code: string) => `{{html}}\n${code}\n{{/html}}`;

const IMG_LINE = /^\{\{img\s+(\S+)\s*(?:\|\s*(.*?))?\}\}$/;
const DRIVE_LINE = /^\{\{drive\s+(\S+)\s*(?:\|\s*(\S*)\s*)?(?:\|\s*(.*?))?\}\}$/;

/** Problems an author must fix before saving (the page renderer itself just ignores what it does not trust). */
export function checkRichBody(body: string, { allowHtml }: { allowHtml: boolean }): string | null {
  const blocks = parseBody(body, { allowHtml: true });
  const htmls = blocks.filter((b) => b.type === "html") as { type: "html"; code: string }[];
  if (htmls.length && !allowHtml) return "บล็อก HTML ใช้ได้เฉพาะหน้าข้อมูลที่แอดมินแก้ไข";
  if (htmls.length > MAX_PAGE_HTML_BLOCKS) return `ใส่บล็อก HTML ได้ไม่เกิน ${MAX_PAGE_HTML_BLOCKS} บล็อกต่อหน้า`;
  if (htmls.some((h) => new TextEncoder().encode(h.code).length > MAX_PAGE_HTML_BYTES)) return `บล็อก HTML ใหญ่เกิน ${MAX_PAGE_HTML_BYTES / 1024} KB`;
  if (/\{\{html\}\}/.test(body) && (body.match(/\{\{html\}\}/g)?.length ?? 0) !== (body.match(/\{\{\/html\}\}/g)?.length ?? 0)) return "บล็อก HTML ต้องมี {{/html}} ปิดท้ายทุกบล็อก";
  return null;
}

/** A link target we are willing to render: https://..., a site path, mailto: or tel:. Anything else becomes plain text. */
export const safeHref = (h: string) =>
  /^https:\/\/[^\s<>"']+$/i.test(h) || /^\/(?!\/)[^\s<>"']*$/.test(h) || /^mailto:[^\s<>"']+$/i.test(h) || /^tel:[+\d\-\s]+$/i.test(h);

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push(safeHref(m[2]) ? { text: m[1], href: m[2] } : { text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function parseBody(body: string, opts: { allowHtml?: boolean } = {}): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: Inline[][] | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", inline: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "ul", items: list });
    list = null;
  };
  const lines = body.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "{{html}}") {
      const close = lines.findIndex((l, j) => j > i && l.trim() === "{{/html}}");
      if (close !== -1) {
        flushPara();
        flushList();
        if (opts.allowHtml) blocks.push({ type: "html", code: lines.slice(i + 1, close).join("\n") });
        i = close;
        continue;
      }
    }
    const im = IMG_LINE.exec(line);
    if (im && CONTENT_KEY_RE.test(im[1])) {
      flushPara();
      flushList();
      blocks.push({ type: "img", key: im[1], alt: (im[2] ?? "").trim() });
      continue;
    }
    const dr = DRIVE_LINE.exec(line);
    if (dr && DRIVE_ID_RE.test(dr[1])) {
      flushPara();
      flushList();
      blocks.push({ type: "drive", id: dr[1], thumbKey: dr[2] && CONTENT_KEY_RE.test(dr[2]) ? dr[2] : null, title: (dr[3] ?? "").trim() });
      continue;
    }
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    if (line.startsWith("## ")) {
      flushPara();
      flushList();
      blocks.push({ type: "h", text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("- ")) {
      flushPara();
      (list ??= []).push(parseInline(line.slice(2).trim()));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}
