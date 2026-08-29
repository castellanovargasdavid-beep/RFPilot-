import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ confirmed: z.boolean() });

/**
 * Confirmación humana explícita de una cita — el "copiloto auditable"
 * (ver ARCHITECTURE.md). El guardrail determinista y el nivel de certeza
 * de Claude son una ayuda, no un veredicto: es el usuario quien tiene que
 * marcar activamente que ha revisado la cláusula citada antes de confiar
 * en el resultado, sobre todo si va a descartar o preparar una oferta en
 * base a él.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string; requirementId: string } }
) {
  const membership = await getApiMembership();
  if (!membership) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Nunca confiar en el requirementId por sí solo: se verifica a través de
  // la cadena tender -> analysis -> requirement, todo scoped a la
  // organización del usuario autenticado (aislamiento multi-tenant).
  const requirement = await prisma.exclusionRequirement.findFirst({
    where: {
      id: params.requirementId,
      analysis: { tenderId: params.id, tender: { organizationId: membership.organizationId } },
    },
    select: { id: true },
  });
  if (!requirement) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const updated = await prisma.exclusionRequirement.update({
    where: { id: requirement.id },
    data: parsed.data.confirmed
      ? { confirmedByUserId: membership.userId, confirmedAt: new Date() }
      : { confirmedByUserId: null, confirmedAt: null },
    select: { id: true, confirmedByUserId: true, confirmedAt: true },
  });

  return NextResponse.json(updated);
}
