/** How fresh the database copies are (pure: the dashboard and the system page use the same words). */
export const BACKUP_WARN_DAYS = 7;
export const BACKUP_DANGER_DAYS = 30;

export type BackupState = "never" | "ok" | "old" | "stale";

export function backupState(lastBackupAt: Date | null, now = new Date()): { state: BackupState; days: number | null } {
  if (!lastBackupAt) return { state: "never", days: null };
  const days = Math.floor((now.getTime() - lastBackupAt.getTime()) / 86400000);
  return { state: days > BACKUP_DANGER_DAYS ? "stale" : days > BACKUP_WARN_DAYS ? "old" : "ok", days };
}

export const BACKUP_TEXT: Record<BackupState, string> = {
  never: "ยังไม่เคยสำรองข้อมูลด้วยสคริปต์ของระบบ",
  ok: "สำรองล่าสุดยังใหม่",
  old: `สำรองล่าสุดเกิน ${BACKUP_WARN_DAYS} วันแล้ว`,
  stale: `สำรองล่าสุดเกิน ${BACKUP_DANGER_DAYS} วันแล้ว`,
};
