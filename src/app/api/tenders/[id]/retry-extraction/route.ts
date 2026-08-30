import { NextResponse } from "next/server";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";

/**
 * Un pliego escaneado grande puede tardar varios minutos en OCR (ver
 * MAX_OCR_PAGES en src/server/pdf/ocr.ts) — por debajo de este umbral no
 * dejamos reintentar un tender en EXTRACTING para no interrumpir una
 * ejecución de Inngest legítima que sigue en curso. Por encima, lo tratamos
 * como atascado (p.ej. el evento se perdió porque la app de Inngest no
 * estaba sincronizada) y permitimos reintentar.
 */
const STUCK_EXTRACTING_THRESHOLD_MS = 8 * 60 * 1000;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const membership = await getApiMembership();
  if (!membership) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tender = await prisma.tender.findFirst({
    where: { id: params.id, organizationId: membership.organizationId },
    select: { id: true, status: true, updatedAt: true },
  });
  if (!tender) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const stuckExtracting =
    tender.status === "EXTRACTING" &&
    Date.now() - tender.updatedAt.getTime() > STUCK_EXTRACTING_THRESHOLD_MS;

  if (tender.status !== "EXTRACTION_FAILED" && !stuckExtracting) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  await inngest.send({ name: "tender/uploaded", data: { tenderId: tender.id } });

  return NextResponse.json({ ok: true });
}
