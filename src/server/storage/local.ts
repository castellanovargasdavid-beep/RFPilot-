import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

/**
 * Backend de almacenamiento local en disco — solo para desarrollo cuando no
 * hay BLOB_READ_WRITE_TOKEN configurado. En producción (Vercel) se usa
 * @vercel/blob; ver src/server/storage/index.ts.
 */
const LOCAL_STORAGE_ROOT = path.join(process.cwd(), ".local-blob-storage");
const LOCAL_URL_PREFIX = "/api/local-blob/";

export function isLocalUrl(url: string): boolean {
  return url.startsWith(LOCAL_URL_PREFIX);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150);
}

export async function saveLocalFile(
  organizationId: string,
  filename: string,
  buffer: Buffer
): Promise<{ url: string; key: string }> {
  const key = `${organizationId}/${randomUUID()}-${sanitizeFilename(filename)}`;
  const fullPath = path.join(LOCAL_STORAGE_ROOT, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return { url: `${LOCAL_URL_PREFIX}${key}`, key };
}

export async function readLocalFile(url: string): Promise<Buffer> {
  const key = url.slice(LOCAL_URL_PREFIX.length);
  const resolvedRoot = path.resolve(LOCAL_STORAGE_ROOT);
  const fullPath = path.resolve(LOCAL_STORAGE_ROOT, key);
  if (!fullPath.startsWith(resolvedRoot + path.sep)) {
    throw new Error("Ruta de almacenamiento local inválida");
  }
  return readFile(fullPath);
}
