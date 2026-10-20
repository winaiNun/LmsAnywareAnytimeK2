import { getStorage } from "@/lib/storage";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  // media library uploads (only exist while the admin allows server uploads)
  pdf: "application/pdf",
  epub: "application/epub+zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  mp3: "audio/mpeg",
};
const INLINE = new Set(["png", "jpg", "jpeg", "webp", "mp4", "webm", "pdf", "mp3"]);

// Only public site assets are served here. Member-only files (books, lessons)
// will get their own permission-checked route.
const PUBLIC_PREFIXES = ["content/", "banners/", "site/", "schools/", "avatars/", "media/"];

export async function GET(req: Request, { params }: { params: { key: string[] } }) {
  const key = params.key.join("/");
  const type = TYPES[key.split(".").pop()?.toLowerCase() ?? ""];
  if (!type || !PUBLIC_PREFIXES.some((p) => key.startsWith(p)) || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  let data: Buffer;
  try {
    data = await getStorage().get(key);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=3600",
  };
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  if (!INLINE.has(ext)) headers["Content-Disposition"] = `attachment; filename="${key.split("/").pop()}"`; // documents download, never render in our origin

  // Browsers need byte ranges to loop/seek <video>.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = data.length;
    let start = range[1] ? parseInt(range[1], 10) : size - parseInt(range[2], 10);
    let end = range[1] && range[2] ? parseInt(range[2], 10) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new Response(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
}
