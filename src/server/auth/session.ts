import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { OrgRole } from "@prisma/client";

/**
 * Aislamiento multi-tenant: toda página/acción del dashboard debe resolver
 * su Organization a través de esta función, nunca aceptar un organizationId
 * que llegue del cliente sin verificar que el usuario tiene membership en él.
 *
 * MVP: cada usuario opera sobre su primera organización (la creada al
 * registrarse). El modelo Membership ya soporta pertenencia a varias orgs
 * para cuando se añada un selector de organización (invitaciones de equipo).
 */
export const getActiveMembership = cache(async function getActiveMembership() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: { organization: true },
  });

  return membership;
});

export async function requireActiveMembership() {
  const membership = await getActiveMembership();
  if (!membership) {
    redirect("/login");
  }
  return membership;
}

export async function requireRole(roles: OrgRole[]) {
  const membership = await requireActiveMembership();
  if (!roles.includes(membership.role)) {
    throw new Error("No autorizado para esta acción");
  }
  return membership;
}
