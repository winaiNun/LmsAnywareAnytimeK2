import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./index";

export type S3Config = {
  endpoint?: string; // empty = AWS; set for Cloudflare R2, Supabase Storage, MinIO
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean; // MinIO / Supabase need true; R2 works with either
  publicBaseUrl?: string; // public CDN / bucket URL; when set, files are linked directly
};

export function s3ConfigFromEnv(): S3Config {
  const need = (name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`Missing environment variable ${name} (required when STORAGE_DRIVER=s3)`);
    return v;
  };
  return {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "auto",
    bucket: need("S3_BUCKET"),
    accessKeyId: need("S3_ACCESS_KEY_ID"),
    secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    publicBaseUrl: process.env.S3_PUBLIC_URL?.replace(/\/+$/, "") || undefined,
  };
}

/** Any S3-compatible store: Cloudflare R2, Supabase Storage (S3 endpoint), MinIO, AWS S3. */
export class S3StorageProvider implements StorageProvider {
  readonly driver = "s3";
  private client: S3Client;

  constructor(private cfg: S3Config) {
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: cfg.forcePathStyle,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }

  async put(key: string, data: Buffer, mimeType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: data,
        ContentType: mimeType,
        // keys contain a random id, so a stored object never changes
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    if (!res.Body) throw new Error(`Empty object: ${key}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }

  async presignUpload(key: string, mimeType: string) {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, ContentType: mimeType }), { expiresIn: 600 });
  }

  publicUrl(key: string) {
    return this.cfg.publicBaseUrl ? `${this.cfg.publicBaseUrl}/${key}` : undefined;
  }
}
