/* Needs the local database: npm run test:db (creates and removes its own rows: titles start with "zz-test", users with "zz.media") */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { deleteMediaAs, reviewMediaAs, saveMediaAs, setMediaPinnedAs, unpublishMediaAs } from "../src/lib/media-save";
import type { Actor } from "../src/lib/media-access";

const db = new PrismaClient();
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const DRIVE = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view";

type Item = { id?: string; kind: "LINK" | "HTML" | "UPLOAD" | "IMAGE"; label?: string; url?: string; html?: string };
function form(over: Partial<{ title: string; areaId: string; items: Item[]; submit: boolean; levelIds: string[]; tags: string; cover: object; typeId: string | null }> & { areaId: string }) {
  const fd = new FormData();
  fd.set("payload", JSON.stringify({
    title: over.title ?? "zz-test สื่อทดสอบ", description: "ทดสอบ", areaId: over.areaId, typeId: over.typeId ?? null, levelIds: over.levelIds ?? [], tags: over.tags ?? "ก, ข, ก",
    cover: over.cover ?? { mode: "none" }, items: over.items ?? [{ kind: "LINK", url: YT }], submit: over.submit ?? false,
  }));
  return fd;
}

async function mkUser(tag: string, memberType: "TEACHER" | "STUDENT" | "GENERAL", role: "ADMIN" | "STUDENT" = "STUDENT") {
  const u = await db.user.create({ data: { username: `zz.media.${tag}`, name: `zz ${tag}`, memberType, role, passwordHash: await bcrypt.hash("x-not-used-9", 4) } });
  return u;
}
const actorOf = (u: { id: string; role: string; memberType: string }, areas: string[] = []): Actor => ({ id: u.id, role: u.role, memberType: u.memberType, reviewerAreaIds: areas });

async function main() {
  const [math, science] = await Promise.all([db.learningArea.findUniqueOrThrow({ where: { slug: "math" } }), db.learningArea.findUniqueOrThrow({ where: { slug: "science" } })]);
  const level = await db.educationLevel.findFirstOrThrow();
  // the result must not depend on what the admin switched on in this database: pin the setting, restore it afterwards
  const prevSetting = await db.siteSetting.findUnique({ where: { id: "main" } });
  const setUploads = (on: boolean) => db.siteSetting.upsert({ where: { id: "main" }, create: { id: "main", allowServerUploads: on }, update: { allowServerUploads: on } });
  await setUploads(false);
  const users = await Promise.all([mkUser("admin", "GENERAL", "ADMIN"), mkUser("author", "TEACHER"), mkUser("revmath", "TEACHER"), mkUser("revsci", "TEACHER"), mkUser("other", "GENERAL"), mkUser("kid", "STUDENT")]);
  const [uAdmin, uAuthor, uRevM, uRevS, uOther, uKid] = users;
  const admin = actorOf(uAdmin), author = actorOf(uAuthor), revMath = actorOf(uRevM, [math.id]), revSci = actorOf(uRevS, [science.id]), other = actorOf(uOther), kid = actorOf(uKid);
  await db.areaReviewer.createMany({ data: [{ userId: uRevM.id, areaId: math.id }, { userId: uRevS.id, areaId: science.id }] });

  try {
    // 1) member saves a draft, tags are cleaned, levels linked
    let r = await saveMediaAs(author, null, form({ areaId: math.id, levelIds: [level.id], tags: "ก, ข, ก,  " }));
    assert.equal(r.error, undefined);
    assert.equal(r.status, "DRAFT");
    const id = r.id!;
    let full = await db.media.findUniqueOrThrow({ where: { id }, include: { items: true, levels: true } });
    assert.deepEqual(full.tags, ["ก", "ข"]);
    assert.equal(full.levels.length, 1);
    assert.equal(full.items[0].kind, "YOUTUBE");
    assert.equal(full.items[0].url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(full.publishedAt, null);
    let m = await db.media.findUniqueOrThrow({ where: { id } });

    // 2) others cannot edit or delete it
    for (const a of [other, revMath, kid]) {
      assert.match((await saveMediaAs(a, id, form({ areaId: math.id }))).error ?? "", /สิทธิ์/);
      assert.match((await deleteMediaAs(a, id)).error ?? "", /สิทธิ์/);
    }

    // 3) draft cannot be approved (not in the queue); submit -> PENDING
    assert.match((await reviewMediaAs(revMath, id, "approve", "")).error ?? "", /รออนุมัติ/);
    r = await saveMediaAs(author, id, form({ areaId: math.id, submit: true, items: [{ kind: "LINK", url: DRIVE }, { kind: "HTML", html: "<h1>hi</h1>" }] }));
    assert.equal(r.status, "PENDING");
    full = await db.media.findUniqueOrThrow({ where: { id }, include: { items: true, levels: true } });
    assert.deepEqual(full.items.map((i) => i.kind).sort(), ["DRIVE_FILE", "HTML"]);

    // 4) who may decide
    assert.match((await reviewMediaAs(revSci, id, "approve", "")).error ?? "", /สิทธิ์/);
    assert.match((await reviewMediaAs(other, id, "approve", "")).error ?? "", /สิทธิ์/);
    assert.match((await reviewMediaAs(author, id, "approve", "")).error ?? "", /ตัวเอง|สิทธิ์/);
    assert.match((await reviewMediaAs(revMath, id, "reject", "")).error ?? "", /เหตุผล/, "rejecting needs a reason");
    assert.equal((await reviewMediaAs(revMath, id, "reject", "ลิงก์ Drive เปิดไม่ได้ ช่วยตั้งแชร์ใหม่")).error, undefined);
    m = await db.media.findUniqueOrThrow({ where: { id } });
    assert.equal(m.status, "REJECTED");
    assert.match(m.reviewNote ?? "", /Drive/);
    assert.equal(m.reviewedById, uRevM.id);

    // 5) author fixes and resubmits; the reviewer approves; it is published once with a date
    r = await saveMediaAs(author, id, form({ areaId: math.id, submit: true, items: [{ kind: "LINK", url: YT }] }));
    assert.equal(r.status, "PENDING");
    assert.equal((await db.media.findUniqueOrThrow({ where: { id } })).reviewNote, null, "old note cleared on resubmit");
    assert.equal((await reviewMediaAs(revMath, id, "approve", "")).error, undefined);
    m = await db.media.findUniqueOrThrow({ where: { id } });
    assert.equal(m.status, "PUBLISHED");
    assert.ok(m.publishedAt);
    const publishedAt = m.publishedAt!;
    assert.match((await reviewMediaAs(revMath, id, "approve", "")).error ?? "", /รออนุมัติ/, "cannot approve twice");

    // 6) editing live content sends it back to the queue (and keeps the first published date)
    r = await saveMediaAs(author, id, form({ areaId: math.id, title: "zz-test แก้ไขแล้ว" }));
    assert.equal(r.status, "PENDING");
    await reviewMediaAs(revMath, id, "approve", "");
    assert.equal((await db.media.findUniqueOrThrow({ where: { id } })).publishedAt?.getTime(), publishedAt.getTime());

    // 7) a reviewer cannot approve their own submission; an admin can post straight to published
    const own = (await saveMediaAs(revMath, null, form({ areaId: math.id, submit: true, title: "zz-test ของผู้ตรวจ" }))).id!;
    assert.equal((await db.media.findUniqueOrThrow({ where: { id: own } })).status, "PENDING");
    assert.match((await reviewMediaAs(revMath, own, "approve", "")).error ?? "", /ตัวเอง/);
    assert.equal((await reviewMediaAs(admin, own, "approve", "")).error, undefined);
    r = await saveMediaAs(admin, null, form({ areaId: science.id, submit: true, title: "zz-test แอดมินลง", items: [{ kind: "HTML", html: "<p>x</p>" }] }));
    assert.equal(r.status, "PUBLISHED");

    // 8) student rules: links only
    assert.match((await saveMediaAs(kid, null, form({ areaId: math.id, items: [{ kind: "HTML", html: "<p>x</p>" }] }))).error ?? "", /นักเรียน/);
    assert.equal((await saveMediaAs(kid, null, form({ areaId: math.id, items: [{ kind: "LINK", url: YT }] }))).error, undefined);

    // 9) validation: bad links, empty items, too many, oversize HTML, uploads off, bad area, bad cover link
    const bad = async (over: Parameters<typeof form>[0], re: RegExp) => assert.match((await saveMediaAs(author, null, form(over))).error ?? "", re);
    await bad({ areaId: math.id, items: [{ kind: "LINK", url: "javascript:alert(1)" }] }, /https/);
    await bad({ areaId: math.id, items: [{ kind: "LINK", url: "http://example.com" }] }, /https/);
    await bad({ areaId: math.id, items: [] }, /อย่างน้อย 1/);
    await bad({ areaId: math.id, items: Array.from({ length: 11 }, () => ({ kind: "LINK" as const, url: YT })) }, /ไม่เกิน 10/);
    await bad({ areaId: math.id, items: [{ kind: "HTML", html: "x".repeat(600 * 1024) }] }, /ใหญ่เกิน/);
    await bad({ areaId: math.id, items: [{ kind: "UPLOAD" }] }, /ปิดการอัปโหลด/);
    await bad({ areaId: "nope" }, /กลุ่มสาระ/);
    await bad({ areaId: math.id, typeId: "nope" }, /ประเภท/);
    await bad({ areaId: math.id, cover: { mode: "drive", link: "https://example.com/x.png" } }, /drive\.google\.com/);
    await bad({ areaId: math.id, title: "ก" }, /อย่างน้อย 3/);
    await bad({ areaId: math.id, cover: { mode: "upload" } }, /ปิดการอัปโหลด/);

    // 10) cover from Drive is stored as an id, no file
    r = await saveMediaAs(author, null, form({ areaId: math.id, cover: { mode: "drive", link: DRIVE, fx: 0.2, fy: 0.9 } }));
    m = await db.media.findUniqueOrThrow({ where: { id: r.id! } });
    assert.equal(m.coverDriveId, "1AbCdEfGhIjKlMnOpQrStUvWxYz012345");
    assert.equal(m.coverKey, null);
    assert.equal(m.coverFx, 0.2);

    // 11) edit keeps item ids; removed items disappear
    const withTwo = (await saveMediaAs(author, null, form({ areaId: math.id, items: [{ kind: "LINK", url: YT }, { kind: "LINK", url: DRIVE }] }))).id!;
    const [i1, i2] = await db.mediaItem.findMany({ where: { mediaId: withTwo }, orderBy: { sortOrder: "asc" } });
    await saveMediaAs(author, withTwo, form({ areaId: math.id, items: [{ id: i2.id, kind: "LINK", url: DRIVE }] }));
    const left = await db.mediaItem.findMany({ where: { mediaId: withTwo } });
    assert.deepEqual(left.map((i) => i.id), [i2.id]);
    assert.match((await saveMediaAs(author, withTwo, form({ areaId: math.id, items: [{ id: i1.id, kind: "LINK", url: YT }] }))).error ?? "", /ไม่พบรายการเดิม/, "an item id from a removed row is refused");

    // 12) daily limit for members, not for admins
    for (let i = 0; i < 19; i++) await db.media.create({ data: { title: "zz-test filler", areaId: math.id, createdById: uOther.id } });
    assert.equal((await saveMediaAs(other, null, form({ areaId: math.id }))).error, undefined, "the 20th is still allowed");
    assert.match((await saveMediaAs(other, null, form({ areaId: math.id }))).error ?? "", /ไม่เกิน 20/);

    // 13) admin-only actions
    assert.match((await setMediaPinnedAs(author, id, true)).error ?? "", /สิทธิ์/);
    assert.match((await unpublishMediaAs(revMath, id)).error ?? "", /สิทธิ์/);
    assert.equal((await setMediaPinnedAs(admin, id, true)).error, undefined);
    assert.equal((await db.media.findUniqueOrThrow({ where: { id } })).pinned, true);
    assert.equal((await unpublishMediaAs(admin, id)).error, undefined);
    m = await db.media.findUniqueOrThrow({ where: { id } });
    assert.equal(m.status, "DRAFT");
    assert.equal(m.pinned, false);

    // 14) delete takes items and likes with it; the area cannot be deleted while it has media (Restrict)
    await db.mediaLike.create({ data: { userId: uOther.id, mediaId: id } });
    assert.equal((await deleteMediaAs(author, id)).error, undefined);
    assert.equal(await db.mediaItem.count({ where: { mediaId: id } }), 0);
    assert.equal(await db.mediaLike.count({ where: { mediaId: id } }), 0);
    await assert.rejects(() => db.learningArea.delete({ where: { id: math.id } }));

    // 15) uploads: only with the admin switch on; type/size/content are checked; files are removed with the item
    await setUploads(true);
    const pdf = (body: string, name = "ใบงาน.pdf", type = "application/pdf") => { const fd = form({ areaId: math.id, items: [{ kind: "UPLOAD", label: "", fileField: "file_0" } as unknown as Item] }); fd.set("file_0", new File([body], name, { type })); return fd; };
    assert.match((await saveMediaAs(kid, null, pdf("%PDF-1.4 x"))).error ?? "", /นักเรียน/);
    assert.match((await saveMediaAs(author, null, pdf("not a pdf"))).error ?? "", /ไม่ใช่ PDF/);
    assert.match((await saveMediaAs(author, null, pdf("%PDF-1.4", "evil.exe", "application/octet-stream"))).error ?? "", /รองรับไฟล์/);
    assert.match((await saveMediaAs(author, null, pdf("%PDF-1.4" + "x".repeat(5 * 1024 * 1024)))).error ?? "", /4 MB/);
    const up = await saveMediaAs(author, null, pdf("%PDF-1.4 hello"));
    assert.equal(up.error, undefined);
    const upItem = await db.mediaItem.findFirstOrThrow({ where: { mediaId: up.id! } });
    assert.equal(upItem.kind, "UPLOAD");
    assert.match(upItem.storageKey ?? "", /^media\/[0-9a-f-]+\.pdf$/);
    const { getStorage } = await import("../src/lib/storage");
    assert.equal((await getStorage().get(upItem.storageKey!)).toString().startsWith("%PDF-1.4"), true);
    assert.equal((await deleteMediaAs(author, up.id!)).error, undefined);
    await assert.rejects(() => getStorage().get(upItem.storageKey!), "the file is deleted with the media");
    await setUploads(false);

    // 16) YouTube cover (nothing stored) and picture items (cropped by the browser, re-encoded to WebP)
    const yt = await saveMediaAs(author, null, form({ areaId: math.id, cover: { mode: "youtube" } }));
    assert.equal(yt.error, undefined);
    assert.equal((await db.media.findUniqueOrThrow({ where: { id: yt.id! } })).coverYoutubeId, "dQw4w9WgXcQ");
    assert.match((await saveMediaAs(author, null, form({ areaId: math.id, cover: { mode: "youtube" }, items: [{ kind: "LINK", url: DRIVE }] }))).error ?? "", /YouTube/);
    const auto = await saveMediaAs(author, null, form({ areaId: math.id, cover: { mode: "keep" } })); // no cover yet + first item YouTube = its thumbnail
    assert.equal((await db.media.findUniqueOrThrow({ where: { id: auto.id! } })).coverYoutubeId, "dQw4w9WgXcQ");
    const none = await saveMediaAs(author, null, form({ areaId: math.id, cover: { mode: "none" } })); // an explicit "no cover" stays
    assert.equal((await db.media.findUniqueOrThrow({ where: { id: none.id! } })).coverYoutubeId, null);
    const swapped = await saveMediaAs(author, yt.id!, form({ areaId: math.id, cover: { mode: "keep" }, items: [{ kind: "LINK", url: DRIVE }] })); // the video is gone -> its cover goes too
    assert.equal((await db.media.findUniqueOrThrow({ where: { id: swapped.id! } })).coverYoutubeId, null);

    await setUploads(true);
    const sharp = (await import("sharp")).default;
    const png = await sharp({ create: { width: 900, height: 1600, channels: 3, background: "#336699" } }).png().toBuffer();
    const pic = (buf: Buffer) => { const fd = form({ areaId: math.id, items: [{ kind: "IMAGE", label: "", fileField: "img_a" } as unknown as Item] }); fd.set("img_a", new File([new Uint8Array(buf)], "x.webp", { type: "image/webp" })); return fd; };
    assert.match((await saveMediaAs(kid, null, pic(png))).error ?? "", /นักเรียน/);
    assert.match((await saveMediaAs(author, null, pic(Buffer.from("not an image")))).error ?? "", /รูปภาพ/);
    const im = await saveMediaAs(author, null, pic(png));
    assert.equal(im.error, undefined);
    const imItem = await db.mediaItem.findFirstOrThrow({ where: { mediaId: im.id! } });
    assert.equal(imItem.kind, "UPLOAD");
    assert.equal(imItem.mimeType, "image/webp");
    const { getStorage: gs } = await import("../src/lib/storage");
    const meta = await sharp(await gs().get(imItem.storageKey!)).metadata();
    assert.equal(meta.format, "webp");
    assert.ok(Math.abs(meta.width! / meta.height! - 9 / 16) < 0.01);
    // editing without choosing a new picture keeps the stored one
    const keep = await saveMediaAs(author, im.id!, form({ areaId: math.id, items: [{ id: imItem.id, kind: "IMAGE", label: "ภาพ" }] }));
    assert.equal(keep.error, undefined);
    assert.equal((await db.mediaItem.findUniqueOrThrow({ where: { id: imItem.id } })).storageKey, imItem.storageKey);
    assert.equal((await deleteMediaAs(author, im.id!)).error, undefined);
    await setUploads(false);

    console.log("media db: 16 groups passed");
  } finally {
    if (prevSetting) await db.siteSetting.update({ where: { id: "main" }, data: { allowServerUploads: prevSetting.allowServerUploads } });
    else await db.siteSetting.deleteMany({ where: { id: "main" } });
    await db.media.deleteMany({ where: { title: { startsWith: "zz-test" } } });
    await db.user.deleteMany({ where: { username: { startsWith: "zz.media." } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
