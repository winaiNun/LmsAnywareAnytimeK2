import { NextResponse } from "next/server";
import { z } from "zod";
import { getFaqPublic } from "@/lib/faq/data";
import { MAX_QUERY_LENGTH, matchFaq } from "@/lib/faq/match";
import { countFaqHit, logUnanswered } from "@/lib/faq/store";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const body = z.union([z.object({ q: z.string().trim().min(1).max(MAX_QUERY_LENGTH) }), z.object({ id: z.string().min(1).max(60) })]);
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Public FAQ chat. {q} = a typed question, {id} = a starter/suggestion button. No sign-in needed; the answers are
 * public anyway. Limited per IP (per server instance), and nothing about the visitor is stored: unanswered questions only bump a counter.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "คำถามไม่ถูกต้อง (พิมพ์ได้ไม่เกิน 200 ตัวอักษร)" }, 400);

  const data = await getFaqPublic();
  if (!data.enabled) return json({ error: "ปิดให้บริการแชตถามตอบชั่วคราว" }, 404);
  // In-memory limiter on purpose: it costs no database time (a chat question is cheap to answer, and the unanswered table is capped).
  if (rateLimited(`faq:${clientIp(req)}`, 30, 10 * 60 * 1000)) return json({ error: "ถามถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" }, 429);

  const byId = new Map(data.items.map((i) => [i.id, i]));
  const brief = (id: string) => ({ id, question: byId.get(id)?.question ?? "" });

  if ("id" in parsed.data) {
    const item = byId.get(parsed.data.id);
    if (!item) return json({ kind: "none" });
    await countFaqHit(item.id);
    return json({ kind: "answer", id: item.id, question: item.question, answer: item.answer, related: [] });
  }

  const result = matchFaq(parsed.data.q, data.items);
  if (result.kind === "answer") {
    const item = byId.get(result.best.id)!;
    await countFaqHit(item.id);
    return json({ kind: "answer", id: item.id, question: item.question, answer: item.answer, related: result.related.map((m) => brief(m.id)) });
  }
  if (result.kind === "suggest") return json({ kind: "suggest", items: result.items.map((m) => brief(m.id)) });

  await logUnanswered(parsed.data.q);
  return json({ kind: "none" });
}
