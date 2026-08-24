/**
 * Seed de datos de ejemplo — deja lista una demo completa y funcional sin
 * depender de una ANTHROPIC_API_KEY real: usuario, organización, perfil
 * de empresa (deliberadamente incompleto, para mostrar un semáforo mixto
 * realista), y una licitación READY con un análisis sintético coherente
 * con el pliego ficticio de prisma/fixtures/.
 */
try {
  process.loadEnvFile();
} catch {
  // Sin .env local (p.ej. CI/producción con variables ya inyectadas) — seguimos.
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

import { encryptField, encryptAmount } from "../src/lib/crypto";
import { extractTenderDocument } from "../src/server/pdf";
import { saveLocalFile } from "../src/server/storage/local";
import {
  MOCK_TENDER_TITLE,
  MOCK_CONTRACTING_BODY,
  MOCK_MAX_BUDGET,
  MOCK_CONTRACT_DURATION_MONTHS,
  MOCK_SUBMISSION_DEADLINE,
  MOCK_CLARIFICATION_DEADLINE,
} from "./fixtures/mock-tender-content";

const prisma = new PrismaClient();

const MOCK_PDF_PATH = path.join(__dirname, "fixtures/pliego-mantenimiento-informatico.pdf");

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

  // --- Perfil de empresa (deliberadamente incompleto: le falta ISO 27001
  // y la facturación no llega al mínimo exigido, para que el semáforo de
  // la licitación de demo muestre un caso realista "casi cumples, pero no
  // del todo" en vez de todo en verde). ---
  const profile = await prisma.companyProfile.create({
    data: {
      organizationId: organization.id,
      name: "Demo Consulting",
      isDefault: true,
      taxIdEncrypted: encryptField("B87654321"),
      legalForm: "S.L.",
      foundedYear: 2016,
      employeeCount: 18,
      description: "Consultora de servicios TI especializada en mantenimiento de sistemas para el sector público.",
      certifications: {
        create: [{ name: "ISO 9001:2015", issuer: "AENOR", expiresAt: new Date("2027-03-01") }],
      },
      revenueYears: {
        create: [
          { year: 2023, amountEncrypted: encryptAmount(420_000) },
          { year: 2024, amountEncrypted: encryptAmount(440_000) },
          { year: 2025, amountEncrypted: encryptAmount(460_000) },
        ],
      },
      references: {
        create: [
          {
            title: "Mantenimiento de sistemas — Ayuntamiento de Peñalba",
            clientName: "Ayuntamiento de Peñalba",
            sector: "Público",
            amountEncrypted: encryptAmount(180_000),
            startDate: new Date("2022-01-01"),
            endDate: new Date("2023-12-31"),
            description: "Soporte y mantenimiento de infraestructura TI municipal, 120 puestos de trabajo.",
          },
          {
            title: "Soporte TIC — Mancomunidad del Valle Norte",
            clientName: "Mancomunidad del Valle Norte",
            sector: "Público",
            amountEncrypted: encryptAmount(165_000),
            startDate: new Date("2024-01-01"),
            endDate: new Date("2025-12-31"),
            description: "Mesa de ayuda, mantenimiento de servidores y red de comunicaciones.",
          },
        ],
      },
      teamMembers: {
        create: [{ name: "Laura Martín", role: "Responsable de Sistemas", yearsExperience: 6 }],
      },
    },
  });

  // --- Licitación de demo: sube el pliego ficticio, lo extrae con el
  // pipeline real, y crea un análisis sintético equivalente al que
  // produciría la Fase 3 (sin necesitar una llamada real a Claude). ---
  const pdfBuffer = fs.readFileSync(MOCK_PDF_PATH);
  const { url: fileUrl } = await saveLocalFile(organization.id, "pliego-mantenimiento-informatico.pdf", pdfBuffer);
  const extraction = await extractTenderDocument(pdfBuffer);

  const tender = await prisma.tender.create({
    data: {
      organizationId: organization.id,
      uploadedById: user.id,
      title: MOCK_TENDER_TITLE,
      sourceType: "PUBLIC_TENDER",
      contractingBody: MOCK_CONTRACTING_BODY,
      fileUrl,
      fileName: "pliego-mantenimiento-informatico.pdf",
      fileSizeBytes: pdfBuffer.byteLength,
      status: "READY",
      extractedText: extraction.text,
      extractedTextIsOcr: extraction.usedOcr,
      extractionMethod: extraction.extractionMethod,
      pageCount: extraction.pageCount,
      submissionDeadline: new Date(MOCK_SUBMISSION_DEADLINE),
      clarificationDeadline: new Date(MOCK_CLARIFICATION_DEADLINE),
      maxBudget: MOCK_MAX_BUDGET,
      currency: "EUR",
    },
  });

  const analysis = await prisma.tenderAnalysis.create({
    data: {
      tenderId: tender.id,
      companyProfileId: profile.id,
      version: 1,
      status: "COMPLETED",
      promptVersion: "requirements-extraction@1 (seed)",
      modelUsed: "seed-fixture",
      scopeSummary:
        "Mantenimiento preventivo, correctivo y evolutivo de los sistemas informáticos del Ayuntamiento de Villaverde de la Sierra: servidores, puestos de trabajo, red de comunicaciones y aplicaciones corporativas.",
      executiveSummaryJson: {
        scopeSummary:
          "Mantenimiento preventivo, correctivo y evolutivo de los sistemas informáticos del Ayuntamiento de Villaverde de la Sierra: servidores, puestos de trabajo, red de comunicaciones y aplicaciones corporativas.",
        submissionDeadline: MOCK_SUBMISSION_DEADLINE,
        clarificationDeadline: MOCK_CLARIFICATION_DEADLINE,
        maxBudget: MOCK_MAX_BUDGET,
        currency: "EUR",
        contractDurationMonths: MOCK_CONTRACT_DURATION_MONTHS,
        contractingBody: MOCK_CONTRACTING_BODY,
      },
      requirementsSectionUnclear: false,
    },
  });

  const requirements = await Promise.all(
    [
      {
        category: "CERTIFICATION" as const,
        description: "Estar en posesión del certificado ISO 9001 de gestión de la calidad, en vigor.",
        citationText: "Certificado ISO 9001 de gestión de la calidad, en vigor. Requisito excluyente.",
        citationPage: 3,
        citationClause: "Cláusula 5.3",
        isMandatory: true,
      },
      {
        category: "CERTIFICATION" as const,
        description:
          "Estar en posesión del certificado ISO/IEC 27001 de gestión de la seguridad de la información, en vigor.",
        citationText:
          "Certificado ISO/IEC 27001 de gestión de la seguridad de la información, en vigor. Requisito excluyente, dado que el servicio implica el tratamiento de datos del padrón municipal.",
        citationPage: 3,
        citationClause: "Cláusula 5.3",
        isMandatory: true,
      },
      {
        category: "CERTIFICATION" as const,
        description: "Disponer de la certificación en el Esquema Nacional de Seguridad (ENS), categoría media o superior.",
        citationText:
          "Se valorará adicionalmente, sin ser excluyente, la certificación en el Esquema Nacional de Seguridad (ENS), categoría media o superior.",
        citationPage: 3,
        citationClause: "Cláusula 5.3",
        isMandatory: false,
      },
      {
        category: "FINANCIAL" as const,
        description:
          "Acreditar un volumen anual de negocios mínimo de 500.000 € en el año de mayor facturación de los últimos tres ejercicios.",
        citationText:
          "La solvencia económica y financiera se acreditará mediante el volumen anual de negocios del licitador, que deberá alcanzar como mínimo el importe de 500.000 €.",
        citationPage: 3,
        citationClause: "Cláusula 5.1",
        isMandatory: true,
      },
      {
        category: "TECHNICAL_EXPERIENCE" as const,
        description:
          "Haber ejecutado al menos 2 contratos de mantenimiento de sistemas informáticos de administraciones públicas o entidades similares en los últimos 5 años, por importe unitario mínimo de 150.000 €.",
        citationText:
          "El licitador deberá acreditar la ejecución de, al menos, 2 (dos) contratos de mantenimiento de sistemas informáticos de administraciones públicas, de importe unitario no inferior a 150.000 € cada uno.",
        citationPage: 3,
        citationClause: "Cláusula 5.2",
        isMandatory: true,
      },
      {
        category: "INSURANCE" as const,
        description: "Disponer de un seguro de responsabilidad civil con un límite mínimo de 300.000 € por siniestro.",
        citationText:
          "El licitador deberá disponer de un seguro de responsabilidad civil con un límite mínimo de indemnización de 300.000 € por siniestro.",
        citationPage: 4,
        citationClause: "Cláusula 5.4",
        isMandatory: true,
      },
      {
        category: "TEAM_QUALIFICATION" as const,
        description:
          "Disponer de al menos un técnico con certificación ITIL v4 Foundation y un mínimo de 5 años de experiencia en gestión de servicios TI.",
        citationText:
          "El licitador deberá disponer de al menos un técnico con certificación ITIL v4 Foundation (o superior) y un mínimo de 5 años de experiencia en gestión de servicios TI.",
        citationPage: 4,
        citationClause: "Cláusula 5.5",
        isMandatory: true,
      },
      {
        category: "LEGAL_ADMINISTRATIVE" as const,
        description:
          "No estar incurso en prohibición de contratar y hallarse al corriente de obligaciones tributarias y con la Seguridad Social.",
        citationText:
          "Declaración responsable conforme al modelo del Anexo II, no estando incursos en prohibición de contratar, y hallándose al corriente en el cumplimiento de sus obligaciones tributarias y con la Seguridad Social.",
        citationPage: 4,
        citationClause: "Cláusula 6",
        isMandatory: true,
      },
    ].map((req, index) =>
      prisma.exclusionRequirement.create({ data: { analysisId: analysis.id, order: index, ...req } })
    )
  );

  await prisma.scoringCriterion.createMany({
    data: [
      { analysisId: analysis.id, name: "Oferta económica", weightPercent: 40, maxPoints: 40, order: 0 },
      {
        analysisId: analysis.id,
        name: "Plan de mantenimiento preventivo y correctivo",
        weightPercent: 25,
        maxPoints: 25,
        order: 1,
      },
      {
        analysisId: analysis.id,
        name: "Metodología de gestión de incidencias y SLA",
        weightPercent: 20,
        maxPoints: 20,
        order: 2,
      },
      {
        analysisId: analysis.id,
        name: "Mejoras adicionales sin coste",
        description: "Incluye hasta 5 puntos por disponer de certificación ENS categoría media o superior.",
        weightPercent: 15,
        maxPoints: 15,
        order: 3,
      },
    ],
  });

  // --- Cruce de elegibilidad real (el mismo motor determinista de la Fase 4). ---
  const { runEligibilityCrossCheck } = await import("../src/server/eligibility/run-cross-check");
  const rollup = await runEligibilityCrossCheck(tender.id, profile.id);

  // --- Borrador de propuesta de demo, con la estructura exigida por el
  // Anexo I del pliego (algunas secciones ya redactadas, otras vacías —
  // para poder probar tanto la lectura como "Regenerar con IA"). ---
  const draft = await prisma.proposalDraft.create({
    data: {
      tenderId: tender.id,
      companyProfileId: profile.id,
      title: `Propuesta técnica — ${MOCK_TENDER_TITLE}`,
      status: "DRAFT",
    },
  });

  await prisma.proposalSection.create({
    data: {
      draftId: draft.id,
      order: 0,
      title: "Resumen ejecutivo de la propuesta",
      instructions: "Presentación general de la empresa y enfoque de la propuesta.",
      status: "GENERATED",
      content:
        "Demo Consulting presenta su propuesta para el **mantenimiento de sistemas informáticos** del Ayuntamiento de Villaverde de la Sierra, con un enfoque centrado en la disponibilidad de los servicios TIC municipales y la calidad del soporte a los más de 180 puestos de trabajo del consistorio.\n\n- Más de 6 años de experiencia del equipo en gestión de servicios TI.\n- Certificación ISO 9001 de gestión de la calidad.\n- Referencias contrastadas en mantenimiento de sistemas para el sector público.",
    },
  });

  const methodologySection = await prisma.proposalSection.create({
    data: {
      draftId: draft.id,
      order: 1,
      title: "Plan de mantenimiento preventivo y correctivo",
      instructions:
        "Calendario de revisiones preventivas y procedimiento detallado de mantenimiento correctivo.",
      status: "EMPTY",
    },
  });

  await prisma.proposalSection.create({
    data: {
      draftId: draft.id,
      parentId: methodologySection.id,
      order: 0,
      title: "Calendario de mantenimiento preventivo",
      instructions: "Periodicidad de las revisiones preventivas por tipo de activo.",
      status: "EMPTY",
    },
  });

  await prisma.proposalSection.create({
    data: {
      draftId: draft.id,
      order: 2,
      title: "Metodología de gestión de incidencias y SLA",
      instructions: "Tiempos de respuesta y resolución por criticidad, herramienta de gestión de incidencias.",
      status: "EMPTY",
    },
  });

  await prisma.proposalSection.create({
    data: {
      draftId: draft.id,
      order: 3,
      title: "Equipo técnico asignado",
      instructions: "Perfiles, titulaciones y experiencia del equipo asignado al contrato.",
      status: "EDITED",
      content:
        "El equipo asignado está liderado por **Laura Martín**, Responsable de Sistemas, con 6 años de experiencia en gestión de servicios TI para el sector público.",
    },
  });

  await prisma.proposalSection.create({
    data: {
      draftId: draft.id,
      order: 4,
      title: "Mejoras adicionales propuestas",
      instructions: "Mejoras sin coste adicional para el Ayuntamiento.",
      status: "EMPTY",
    },
  });

  console.log(`Seed completo. Login: ${email} / demo12345`);
  console.log(`Licitación de demo creada con semáforo: ${rollup.status} (score ${rollup.score}/100).`);
  console.log(`Requisitos sembrados: ${requirements.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
