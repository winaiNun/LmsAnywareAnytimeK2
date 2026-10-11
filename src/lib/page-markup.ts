/**
 * The tiny, safe markup used for page and lesson text (no HTML): blank line = new paragraph, "## " = heading,
 * "- " = list item, [text](https://...) = link (https, "/path", mailto: and tel: only). No database here, so the
 * editor can use it in the browser for a live preview.
 */
export type Inline = { text: string; href?: string };
export type Block = { type: "h"; text: string } | { type: "p"; inline: Inline[] } | { type: "ul"; items: Inline[][] };

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

export function parseBody(body: string): Block[] {
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
  for (const raw of body.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
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
