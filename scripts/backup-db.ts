/**
 * Back up the database to a file you can keep:  npm run db:backup
 *   BACKUP_DIR   where to put it (default ./backups, which git ignores)
 *   BACKUP_KEEP  how many copies to keep (default 14, the oldest are deleted)
 * Works with the database in DIRECT_URL (else DATABASE_URL): the live Neon/Supabase one, or the local one. Uses pg_dump from this
 * computer if it is installed, otherwise runs it inside Docker (postgres:17 image). Writes a compressed "custom format" file that
 * pg_restore reads. When it succeeds it records the time in the settings, so the admin dashboard can warn when copies get old.
 * Files in the storage bucket (pictures, videos) are NOT in this file: see DEPLOY.md "สำรองและกู้คืน".
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { hostname } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL / DIRECT_URL is not set.");
  process.exit(1);
}
const keep = Math.max(1, Number(process.env.BACKUP_KEEP ?? 14) || 14);
const dir = path.resolve(process.env.BACKUP_DIR ?? "backups");
mkdirSync(dir, { recursive: true });

// libpq does not know Prisma's query options (schema=, pgbouncer=, connection_limit=)
const url = new URL(raw);
for (const k of ["schema", "pgbouncer", "connection_limit", "pool_timeout"]) url.searchParams.delete(k);
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const file = `lms-${stamp}.dump`;
const target = path.join(dir, file);

const hasLocal = spawnSync("pg_dump", ["--version"], { encoding: "utf8" }).status === 0;
let r;
if (hasLocal) {
  console.log("pg_dump found on this computer.");
  r = spawnSync("pg_dump", ["-Fc", "--no-owner", "--no-privileges", "-f", target, url.toString()], { stdio: ["ignore", "inherit", "inherit"] });
} else {
  console.log("pg_dump not installed: using Docker (postgres:17-alpine).");
  const dockerUrl = new URL(url.toString());
  if (["localhost", "127.0.0.1"].includes(dockerUrl.hostname)) dockerUrl.hostname = "host.docker.internal"; // the container must reach this computer
  r = spawnSync("docker", ["run", "--rm", "-v", `${dir}:/out`, "postgres:17-alpine", "pg_dump", "-Fc", "--no-owner", "--no-privileges", "-f", `/out/${file}`, dockerUrl.toString()], { stdio: ["ignore", "inherit", "inherit"] });
}
if (r.status !== 0) {
  console.error("Backup FAILED (nothing was recorded).");
  process.exit(1);
}
const bytes = statSync(target).size;
if (bytes < 1024) {
  console.error("Backup file is empty - FAILED.");
  process.exit(1);
}
console.log(`Backup written: ${target} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);

// keep the newest `keep` copies
const all = readdirSync(dir).filter((f) => /^lms-.*\.dump$/.test(f)).sort();
for (const old of all.slice(0, Math.max(0, all.length - keep))) {
  unlinkSync(path.join(dir, old));
  console.log(`Removed old copy ${old}`);
}

const note = `${file} · ${(bytes / 1024 / 1024).toFixed(2)} MB · ${hostname()}`;
const db = new PrismaClient();
db.$transaction([
  db.siteSetting.upsert({ where: { id: "main" }, update: { lastBackupAt: new Date(), lastBackupNote: note }, create: { id: "main", lastBackupAt: new Date(), lastBackupNote: note } }),
  db.auditLog.create({ data: { action: "system.backup", entity: "System", meta: { file, bytes } } }),
])
  .then(() => console.log("Recorded in the settings (admin > สถานะระบบ shows it)."))
  .catch((e) => console.error("The file is safe, but recording it failed:", e.message))
  .finally(() => db.$disconnect());
