import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Record who did what. Never throws: a failed log line must not break the action itself. */
export async function audit(entry: { actorId?: string | null; action: string; entity: string; entityId?: string | null; meta?: Prisma.InputJsonValue }) {
  try {
    await db.auditLog.create({ data: { actorId: entry.actorId ?? null, action: entry.action, entity: entry.entity, entityId: entry.entityId ?? null, meta: entry.meta } });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
