import { LocalStorageProvider } from "./local";
import { S3StorageProvider, s3ConfigFromEnv } from "./s3";

/** Swappable file storage. Keep DB rows storage-agnostic: store only `key` + `driver`. */
export interface StorageProvider {
  readonly driver: string;
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Direct public URL (CDN / public bucket), or undefined when files must go through /api/files. */
  publicUrl?(key: string): string | undefined;
  /** Short-lived signed URL the browser can PUT a file to directly (skips the server body-size limit). */
  presignUpload?(key: string, mimeType: string): Promise<string>;
}

let instance: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  switch (driver) {
    case "local":
      instance = new LocalStorageProvider(process.env.STORAGE_LOCAL_DIR ?? "./storage");
      return instance;
    case "s3":
      instance = new S3StorageProvider(s3ConfigFromEnv());
      return instance;
    // case "gdrive": only if member-only files in Drive are really needed (see PROGRESS.md)
    default:
      throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
  }
}
