/**
 * Test de integración: ejecuta runEligibilityCrossCheck contra Postgres
 * real (no solo la función pura evaluada en memoria, como en
 * engine.test.ts) — crea sus propios datos, verifica que persiste
 * correctamente EligibilityCheck y el rollup en TenderAnalysis, y limpia
 * todo lo que crea. Se salta automáticamente si no hay DATABASE_URL
 * configurada (p.ej. en un entorno CI sin base de datos).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { encryptAmount } from "@/lib/crypto";
import { runEligibilityCrossCheck } from "./run-cross-check";

const hasDatabase = !!process.env.DATABASE_URL;

describe.skipIf(!hasDatabase)("runEligibilityCrossCheck (integración, DB real)", () => {
  let organizationId: string;
  let tenderId: string;
  let analysisId: string;
  let profileId: string;
  let greenRequirementId: string;
  let redRequirementId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: "Integration Test Org", slug: `integration-test-${Date.now()}` },
    });
    organizationId = org.id;

    const user = await prisma.user.create({
      data: { email: `integration-${Date.now()}@test.local`, name: "Integration Test" },
    });

    const tender = await prisma.tender.create({
      data: {
        organizationId,
        uploadedById: user.id,
        title: "Licitación de test de integración",
        fileUrl: "/api/local-blob/test/fake.pdf",
        fileName: "fake.pdf",
        fileSizeBytes: 100,
        status: "READY",
        submissionDeadline: new Date("2027-01-01"),
      },
    });
    tenderId = tender.id;

    const analysis = await prisma.tenderAnalysis.create({
      data: {
        tenderId,
        version: 1,
        status: "COMPLETED",
        promptVersion: "test",
      },
    });
    analysisId = analysis.id;

    const greenReq = await prisma.exclusionRequirement.create({
      data: {
        analysisId,
        category: "CERTIFICATION",
        description: "Estar en posesión del certificado ISO 9001 vigente.",
        isMandatory: true,
        order: 0,
      },
    });
    greenRequirementId = greenReq.id;

    const redReq = await prisma.exclusionRequirement.create({
      data: {
        analysisId,
        category: "CERTIFICATION",
        description: "Estar en posesión del certificado ISO 27001 vigente.",
        isMandatory: true,
        order: 1,
      },
    });
    redRequirementId = redReq.id;

    const profile = await prisma.companyProfile.create({
      data: {
        organizationId,
        name: "Test Company",
        certifications: { create: [{ name: "ISO 9001:2015", expiresAt: new Date("2028-01-01") }] },
        revenueYears: { create: [{ year: 2025, amountEncrypted: encryptAmount(100_000) }] },
      },
    });
    profileId = profile.id;
  });

  afterAll(async () => {
    await prisma.tender.delete({ where: { id: tenderId } }).catch(() => {});
    await prisma.companyProfile.delete({ where: { id: profileId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { contains: "integration-" } } }).catch(() => {});
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  });

  it("persiste un EligibilityCheck GREEN para el requisito que sí cumple y RED para el que no", async () => {
    const rollup = await runEligibilityCrossCheck(tenderId, profileId);

    expect(rollup.status).toBe("RED"); // uno de los dos obligatorios falla -> el conjunto es RED

    const greenCheck = await prisma.eligibilityCheck.findUnique({ where: { requirementId: greenRequirementId } });
    const redCheck = await prisma.eligibilityCheck.findUnique({ where: { requirementId: redRequirementId } });

    expect(greenCheck?.status).toBe("GREEN");
    expect(redCheck?.status).toBe("RED");
  });

  it("actualiza eligibilityStatus y eligibilityScore en TenderAnalysis", async () => {
    await runEligibilityCrossCheck(tenderId, profileId);

    const updated = await prisma.tenderAnalysis.findUniqueOrThrow({ where: { id: analysisId } });
    expect(updated.eligibilityStatus).toBe("RED");
    expect(updated.eligibilityScore).toBe(50); // 1 de 2 obligatorios en GREEN
  });

  it("es idempotente: volver a ejecutarlo actualiza el mismo EligibilityCheck en vez de duplicarlo", async () => {
    await runEligibilityCrossCheck(tenderId, profileId);
    await runEligibilityCrossCheck(tenderId, profileId);

    const checks = await prisma.eligibilityCheck.findMany({ where: { analysisId } });
    expect(checks).toHaveLength(2);
  });
});
