/**
 * Seed de datos de ejemplo. El pliego ficticio real y los datos de
 * CompanyProfile llegan en la Fase 7 (UI + datos mock end-to-end);
 * de momento solo deja la organización de demo lista para desarrollo.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@rfpilot.dev";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed: el usuario demo ya existe, no se hace nada.");
    return;
  }

  const passwordHash = await bcrypt.hash("demo12345", 12);

  const user = await prisma.user.create({
    data: { name: "Usuario Demo", email, passwordHash },
  });

  const organization = await prisma.organization.create({
    data: { name: "Demo Consulting", slug: "demo-consulting" },
  });

  await prisma.membership.create({
    data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
  });

  await prisma.subscription.create({
    data: { organizationId: organization.id, plan: "PRO", status: "ACTIVE" },
  });

  await prisma.creditLedgerEntry.create({
    data: {
      organizationId: organization.id,
      delta: 5,
      reason: "PLAN_GRANT",
      balanceAfter: 5,
      metadata: { note: "Créditos de demo" },
    },
  });

  console.log(`Seed completo. Login: ${email} / demo12345`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
