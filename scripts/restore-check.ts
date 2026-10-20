/**
 * Prove that a backup really restores:  npm run db:restore-check
 * Restores the newest file in BACKUP_DIR (default ./backups) into a THROWAWAY database inside the local Docker Postgres
 * (container RESTORE_CONTAINER, default lmsanywareanytimek2-db-1), counts the main tables, compares with the live database,
 * then drops the throwaway database. It never writes to the live database except to record the date of the check.
 * A backup nobody has ever restored is only a hope.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const container = process.env.RESTORE_CONTAINER ?? "lmsanywareanytimek2-db-1";
const dir = path.resolve(process.env.BACKUP_DIR ?? "backups");
const TEMP = "lms_restore_check";
const TABLES = ["User", "School", "Media", "Course", "Enrollment", "Certificate", "AuditLog"];

const files = (() => {
  try {
    return readdirSync(dir).filter((f) => /^lms-.*\.dump$/.test(f)).sort();
  } catch {
    return [];
  }
})();
if (files.length === 0) {
  console.error(`No backup file in ${dir}. Run npm run db:backup first.`);
  process.exit(1);
}
const file = path.join(dir, files[files.length - 1]);
const sh = (args: string[]) => spawnSync("docker", args, { encoding: "utf8" });
if (sh(["exec", container, "true"]).status !== 0) {
  console.error(`Docker container ${container} is not running (npm run db:up).`);
  process.exit(1);
}
const psql = (db: string, sql: string) => sh(["exec", container, "psql", "-U", "lms", "-d", db, "-tAc", sql]);

async function main() {
  console.log(`Restoring ${path.basename(file)} into a throwaway database ...`);
  psql("postgres", `DROP DATABASE IF EXISTS ${TEMP}`);
  if (psql("postgres", `CREATE DATABASE ${TEMP}`).status !== 0) throw new Error("Could not create the throwaway database.");
  try {
    // pg_restore must be at least as new as the pg_dump that wrote the file (the local server may be older): run a postgres:17 client
    // that shares the local database container's network, so "localhost" is that container
    const rs = sh(["run", "--rm", "--network", `container:${container}`, "-e", `PGPASSWORD=${process.env.RESTORE_PASSWORD ?? "lms_dev_password"}`, "-v", `${dir}:/in:ro`, "postgres:17-alpine", "pg_restore", "-h", "localhost", "-U", "lms", "-d", TEMP, "--no-owner", "--no-privileges", `/in/${path.basename(file)}`]);
    if (rs.stderr?.trim()) console.log(`pg_restore notes:\n${rs.stderr.trim().split("\n").slice(0, 8).join("\n")}`);
    const live = new PrismaClient();
    let ok = true;
    console.log("table".padEnd(14), "restored".padStart(10), "live now".padStart(10));
    for (const t of TABLES) {
      const restored = Number(psql(TEMP, `SELECT count(*) FROM "${t}"`).stdout.trim());
      const now = Number(((await live.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}"`)) as { n: number }[])[0].n);
      console.log(t.padEnd(14), String(restored).padStart(10), String(now).padStart(10));
      if (!Number.isFinite(restored)) ok = false; // the table did not come back at all
    }
    const users = Number(psql(TEMP, `SELECT count(*) FROM "User"`).stdout.trim());
    if (!(users > 0)) ok = false;
    if (ok) {
      await live.siteSetting.upsert({ where: { id: "main" }, update: { lastRestoreCheckAt: new Date() }, create: { id: "main", lastRestoreCheckAt: new Date() } });
      await live.auditLog.create({ data: { action: "system.restore-check", entity: "System", meta: { file: path.basename(file), users } } });
    }
    await live.$disconnect();
    console.log(ok ? "RESTORE CHECK PASSED: this backup can be restored. (Counts may differ from live: the data kept changing after the backup.)" : "RESTORE CHECK FAILED.");
    process.exitCode = ok ? 0 : 1;
  } finally {
    psql("postgres", `DROP DATABASE IF EXISTS ${TEMP}`);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
