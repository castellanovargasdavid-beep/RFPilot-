import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { fetchStoredFile } from "@/server/storage";

/**
 * Descarga autenticada del PDF original. Nunca enlazamos la URL de Blob
 * directamente desde el cliente: aunque Vercel Blob use rutas
 * impredecibles, este proxy es lo que garantiza que solo un miembro de la
 * organización dueña de la licitación pueda leer el archivo.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const membership = await getApiMembership();
  if (!membership) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tender = await prisma.tender.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
    select: { fileUrl: true, fileName: true },
  });

  if (!tender) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buffer = await fetchStoredFile(tender.fileUrl);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${tender.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
