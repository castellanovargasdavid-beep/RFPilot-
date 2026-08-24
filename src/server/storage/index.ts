import { isLocalUrl, readLocalFile } from "./local";

/**
 * Adaptador de almacenamiento: mantiene el resto de la app agnóstica de si
 * un fichero vive en Vercel Blob (producción) o en disco local (dev sin
 * cuenta de Vercel). El código que consume archivos (extracción de PDF,
 * descarga autenticada) siempre pasa por fetchStoredFile().
 */
export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function fetchStoredFile(url: string): Promise<Buffer> {
  if (isLocalUrl(url)) {
    return readLocalFile(url);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo descargar el archivo original (HTTP ${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
