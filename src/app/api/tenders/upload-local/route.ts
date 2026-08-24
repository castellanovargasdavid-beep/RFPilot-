import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { saveLocalFile } from "@/server/storage/local";
import { isBlobConfigured } from "@/server/storage";
import { isAllowedTenderFile } from "@/lib/tender-constraints";

/**
 * Fallback de subida solo para desarrollo local sin cuenta de Vercel Blob.
 * En producción (BLOB_READ_WRITE_TOKEN configurado) el cliente sube
 * directo a Blob vía /api/blob/upload — ver ARCHITECTURE.md ("por qué
 * subida directa a Blob").
 */
export async function POST(request: Request) {
  if (isBlobConfigured()) {
    return NextResponse.json({ error: "blob_configured" }, { status: 400 });
  }

  const membership = await getApiMembership();
  if (!membership) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const validationError = isAllowedTenderFile(file);
  if (validationError) {
    return NextResponse.json({ error: "invalid_file", message: validationError }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { url } = await saveLocalFile(membership.organizationId, file.name, buffer);

  return NextResponse.json({ url, fileName: file.name, fileSizeBytes: buffer.byteLength });
}
