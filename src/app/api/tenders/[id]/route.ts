import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";

/** Estado del pipeline para polling desde el cliente durante subida/extracción. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const membership = await getApiMembership();
  if (!membership) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tender = await prisma.tender.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
    select: {
      id: true,
      title: true,
      status: true,
      statusMessage: true,
      pageCount: true,
      extractedTextIsOcr: true,
      extractionMethod: true,
      fileName: true,
      fileSizeBytes: true,
      createdAt: true,
    },
  });

  if (!tender) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(tender);
}
