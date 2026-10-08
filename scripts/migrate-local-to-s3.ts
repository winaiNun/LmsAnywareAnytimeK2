/**
 * Copy every file under STORAGE_LOCAL_DIR into the S3-compatible bucket, keeping the same keys,
 * so database rows keep working after switching STORAGE_DRIVER from "local" to "s3".
 *
 *   STORAGE_DRIVER=s3 (+ S3_* vars) npm run storage:migrate
 *   add --delete-local to remove each local file after it was uploaded
 */
import { promises as fs } from "fs";
import path from "path";
import { S3StorageProvider, s3ConfigFromEnv } from "../src/lib/storage/s3";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
  epub: "application/epub+zip",
};

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function main() {
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");
  const removeLocal = process.argv.includes("--delete-local");
  const s3 = new S3StorageProvider(s3ConfigFromEnv());

  let count = 0;
  let bytes = 0;
  for await (const file of walk(root)) {
    const key = path.relative(root, file).split(path.sep).join("/");
    const data = await fs.readFile(file);
    const type = TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
    await s3.put(key, data, type);
    if (removeLocal) await fs.rm(file);
    count++;
    bytes += data.length;
    console.log(`uploaded ${key} (${Math.round(data.length / 1024)} KB)`);
  }
  console.log(`Done: ${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MB${removeLocal ? " (local copies removed)" : ""}`);
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
