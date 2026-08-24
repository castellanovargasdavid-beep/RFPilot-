import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { MAX_TENDER_FILE_SIZE_BYTES, ALLOWED_TENDER_MIME_TYPES } from "@/lib/tender-constraints";

/**
 * Emite el token para que el navegador suba el PDF directo a Vercel Blob,
 * sin pasar por el body de la función serverless (que en Vercel está
 * limitado a ~4.5MB — insuficiente para pliegos escaneados de 150 páginas).
 * onBeforeGenerateToken corre en nuestro servidor y es donde se verifica
 * la sesión antes de emitir el token — el navegador nunca ve el
 * BLOB_READ_WRITE_TOKEN real.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const membership = await getApiMembership();
        if (!membership) {
          throw new Error("No autorizado");
        }

        return {
          allowedContentTypes: ALLOWED_TENDER_MIME_TYPES,
          maximumSizeInBytes: MAX_TENDER_FILE_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ organizationId: membership.organizationId }),
        };
      },
      onUploadCompleted: async () => {
        // No-op: el cliente confirma la subida explícitamente contra
        // POST /api/tenders (este callback no es fiable en local sin un
        // túnel público, ver docs de Vercel Blob).
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al iniciar la subida" },
      { status: 400 }
    );
  }
}
