import { NextResponse } from "next/server";
import { z } from "zod";
import { getNewsPage } from "@/lib/news/data";

export const dynamic = "force-dynamic";

const query = z.object({ tab: z.string().min(1).max(60), page: z.coerce.number().int().min(1).max(1000).default(1) });

/**
 * One page of one news tab, as JSON, for the tabs on the home page. Public (the news is public anyway). The work is cached
 * (tabs for five minutes, each feed for the minutes its admin chose), and the answer may be shared by the CDN for a few minutes.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = query.safeParse({ tab: searchParams.get("tab") ?? "", page: searchParams.get("page") ?? undefined });
  if (!q.success) return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const data = await getNewsPage(q.data.tab, q.data.page);
  if (!data) return NextResponse.json({ error: "ไม่พบหัวข้อข่าวนี้" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
