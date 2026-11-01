import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type Env = Record<string, string | undefined>;

/** Spaces is on only when a real Bangalore bucket and keys are set. Placeholders stay on local disk. */
export function spacesConfigured(env: Env = process.env) {
  const key = env.S3_ACCESS_KEY ?? "";
  const secret = env.S3_SECRET_KEY ?? "";
  const bucket = env.S3_BUCKET ?? "";
  const endpoint = env.S3_ENDPOINT ?? "";
  if (!bucket || !endpoint || key.length < 8 || secret.length < 8) return false;
  if (key.startsWith("enter-") || secret.startsWith("enter-")) return false;
  return true;
}

export function localFile(key: string) {
  const root = process.env.STORAGE_DIR || path.join(process.cwd(), "data");
  return path.join(root, key);
}

function bucket() {
  return process.env.S3_BUCKET ?? "";
}

async function client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: process.env.S3_REGION || "sgp1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: false,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  });
}

/** Photos, voice notes, imports and exports. Spaces when configured, otherwise the local data folder. */
export async function saveObject(key: string, bytes: Buffer, contentType?: string) {
  if (spacesConfigured()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await client()).send(new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }));
    return key;
  }
  const file = localFile(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return key;
}

export async function loadObject(key: string) {
  if (key.startsWith("/") || key.includes(":\\")) return readFile(key);
  if (spacesConfigured()) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const response = await (await client()).send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const body = await response.Body?.transformToByteArray();
    if (!body) throw new Error("File was empty");
    return Buffer.from(body);
  }
  return readFile(localFile(key));
}

/** Short-lived link to a private object. Null when files are on local disk. */
export async function signedObjectUrl(key: string, options?: { seconds?: number; filename?: string; contentType?: string }) {
  if (!spacesConfigured() || key.startsWith("/")) return null;
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const filename = (options?.filename ?? "file").replace(/"/g, "");
  return getSignedUrl(await client(), new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentType: options?.contentType,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  }), { expiresIn: options?.seconds ?? 300 });
}
