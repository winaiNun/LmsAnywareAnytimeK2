/** Loading media for the pages (server only): one select shape, one card shape, used by lists, rails and admin. */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AvatarData } from "@/lib/avatar";
import { driveThumbnailUrl } from "@/lib/drive";
import { showsOwnerIdentity } from "@/lib/media-access";
import { ITEM_BADGE } from "@/lib/media-server";
import { avatarOf, fileUrl } from "@/lib/site";

export const cardSelect = {
  id: true,
  title: true,
  status: true,
  pinned: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  likeCount: true,
  coverKey: true,
  coverDriveId: true,
  coverFx: true,
  coverFy: true,
  authorName: true,
  area: { select: { id: true, slug: true, name: true, icon: true, color: true } },
  type: { select: { name: true, icon: true } },
  items: { select: { kind: true }, orderBy: { sortOrder: "asc" }, take: 1 },
  createdBy: {
    select: {
      id: true, name: true, memberType: true,
      avatarKey: true, avatarDriveId: true, avatarCx: true, avatarCy: true, avatarZoom: true, avatarAspect: true,
      memberSchool: { select: { name: true } },
    },
  },
} satisfies Prisma.MediaSelect;

export type CardRow = Prisma.MediaGetPayload<{ select: typeof cardSelect }>;

export type MediaCardData = {
  id: string;
  title: string;
  status: string;
  pinned: boolean;
  area: { id: string; slug: string; name: string; icon: string; color: string };
  typeName: string | null;
  badge: string;
  coverUrl: string | null;
  coverFx: number;
  coverFy: number;
  views: number;
  likes: number;
  publishedAt: Date | null;
  owner: { id: string; name: string; avatar: AvatarData | null; subtitle: string | null };
};

export const coverUrlOf = (m: { coverKey: string | null; coverDriveId: string | null }) =>
  m.coverKey ? fileUrl(m.coverKey) : m.coverDriveId ? driveThumbnailUrl(m.coverDriveId, 640) : null;

/** The owner as the public may see them: a student (a minor) is shown only as "นักเรียน" with their school. */
export function ownerOf(m: Pick<CardRow, "authorName" | "createdBy">): MediaCardData["owner"] {
  const u = m.createdBy;
  if (!showsOwnerIdentity(u.memberType)) return { id: u.id, name: "นักเรียน", avatar: null, subtitle: u.memberSchool?.name ?? null };
  return { id: u.id, name: m.authorName || u.name, avatar: m.authorName ? null : avatarOf(u), subtitle: u.memberSchool?.name ?? null };
}

export function toCard(m: CardRow): MediaCardData {
  return {
    id: m.id,
    title: m.title,
    status: m.status,
    pinned: m.pinned,
    area: m.area,
    typeName: m.type?.name ?? null,
    badge: m.items[0] ? ITEM_BADGE[m.items[0].kind] ?? "สื่อ" : "สื่อ",
    coverUrl: coverUrlOf(m),
    coverFx: m.coverFx,
    coverFy: m.coverFy,
    views: m.viewCount,
    likes: m.likeCount,
    publishedAt: m.publishedAt,
    owner: ownerOf(m),
  };
}

export async function getFormOptions() {
  const [areas, types, levels] = await Promise.all([
    db.learningArea.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, icon: true } }),
    db.mediaType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, icon: true } }),
    db.educationLevel.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return { areas, types, levels };
}

export const STATUS_LABEL: Record<string, [string, string]> = {
  DRAFT: ["ร่าง", "bg-neutral-100 text-neutral-600"],
  PENDING: ["รออนุมัติ", "bg-amber-50 text-amber-800"],
  PUBLISHED: ["เผยแพร่แล้ว", "bg-green-50 text-green-700"],
  REJECTED: ["ส่งกลับให้แก้", "bg-red-50 text-red-700"],
};

export const fullInclude = {
  area: true,
  type: true,
  levels: { include: { level: { select: { id: true, name: true } } } },
  // No html body here: a pasted HTML app (up to 500 KB) is framed from its own route, so the detail pages never need to read it.
  items: { orderBy: { sortOrder: "asc" as const }, select: { id: true, mediaId: true, kind: true, label: true, url: true, storageKey: true, mimeType: true, sizeBytes: true, sortOrder: true } },
  createdBy: { select: cardSelect.createdBy.select },
} satisfies Prisma.MediaInclude;

export type FullMedia = Prisma.MediaGetPayload<{ include: typeof fullInclude }>;

export const loadFullMedia = (id: string) => db.media.findUnique({ where: { id }, include: fullInclude });

/** The edit forms DO need the html text of an HTML item, so they load the whole row. */
export const editInclude = { ...fullInclude, items: { orderBy: { sortOrder: "asc" as const } } } satisfies Prisma.MediaInclude;
export type EditMedia = Prisma.MediaGetPayload<{ include: typeof editInclude }>;
export const loadEditMedia = (id: string) => db.media.findUnique({ where: { id }, include: editInclude });

/** Stored row -> the values the edit form starts with. */
export function formValuesOf(m: EditMedia): import("@/app/dashboard/media/media-form").MediaFormValues {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    areaId: m.areaId,
    typeId: m.typeId ?? "",
    levelIds: m.levels.map((l) => l.levelId),
    tags: m.tags.join(", "),
    authorName: m.authorName ?? "",
    coverUrl: coverUrlOf(m),
    coverDrive: m.coverDriveId ? `https://drive.google.com/file/d/${m.coverDriveId}/view` : "",
    coverFx: m.coverFx,
    coverFy: m.coverFy,
    status: m.status,
    reviewNote: m.reviewNote,
    items: m.items.map((i) =>
      i.kind === "HTML"
        ? { id: i.id, kind: "HTML" as const, label: i.label, url: "", html: i.html ?? "" }
        : i.kind === "UPLOAD"
          ? { id: i.id, kind: "UPLOAD" as const, label: i.label, url: "", html: "", existingFile: i.storageKey?.split("/").pop() ?? "ไฟล์" }
          : { id: i.id, kind: "LINK" as const, label: i.label, url: i.url ?? "", html: "" },
    ),
  };
}
