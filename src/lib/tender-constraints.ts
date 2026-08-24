export const MAX_TENDER_FILE_SIZE_BYTES = 80 * 1024 * 1024; // 80MB — cubre pliegos escaneados de 150 páginas
export const ALLOWED_TENDER_MIME_TYPES = ["application/pdf"];

export function isAllowedTenderFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TENDER_MIME_TYPES.includes(file.type)) {
    return "Solo se admiten archivos PDF.";
  }
  if (file.size > MAX_TENDER_FILE_SIZE_BYTES) {
    return `El archivo supera el tamaño máximo permitido (${Math.round(MAX_TENDER_FILE_SIZE_BYTES / 1024 / 1024)}MB).`;
  }
  return null;
}
