import { prisma } from "@/lib/prisma";
import { encryptField, decryptField, encryptAmount, decryptAmount } from "@/lib/crypto";
import type { EligibilityCompanyProfile } from "@/server/eligibility/types";

/**
 * Capa de acceso a datos del perfil de empresa: es la única parte del
 * código que cifra/descifra los campos sensibles (CIF/NIF, facturación,
 * importes de referencias). El resto de la app nunca ve el ciphertext ni
 * tiene que acordarse de descifrar — trabaja con los tipos de aquí.
 *
 * MVP: una organización tiene un único perfil de empresa "por defecto"
 * (isDefault). El modelo ya soporta varios perfiles (multi-cliente, plan
 * Agencia) para cuando se construya el selector de organización/cliente.
 */

export async function getOrCreateDefaultProfile(organizationId: string) {
  const existing = await prisma.companyProfile.findFirst({
    where: { organizationId, isDefault: true },
  });
  if (existing) return existing;

  return prisma.companyProfile.create({
    data: { organizationId, name: "Mi empresa", isDefault: true },
  });
}

export interface CompanyProfileView {
  id: string;
  name: string;
  taxId: string | null;
  legalForm: string | null;
  foundedYear: number | null;
  employeeCount: number | null;
  description: string | null;
  certifications: Array<{
    id: string;
    name: string;
    issuer: string | null;
    certificateNumber: string | null;
    issuedAt: Date | null;
    expiresAt: Date | null;
  }>;
  revenueYears: Array<{ id: string; year: number; amount: number; currency: string }>;
  references: Array<{
    id: string;
    title: string;
    clientName: string;
    description: string | null;
    amount: number | null;
    currency: string;
    startDate: Date | null;
    endDate: Date | null;
    sector: string | null;
  }>;
  teamMembers: Array<{ id: string; name: string; role: string; yearsExperience: number | null; qualifications: string | null }>;
}

export async function getProfileView(profileId: string, organizationId: string): Promise<CompanyProfileView | null> {
  const profile = await prisma.companyProfile.findFirst({
    where: { id: profileId, organizationId },
    include: { certifications: true, revenueYears: true, references: true, teamMembers: true },
  });
  if (!profile) return null;

  return {
    id: profile.id,
    name: profile.name,
    taxId: profile.taxIdEncrypted ? decryptField(profile.taxIdEncrypted) : null,
    legalForm: profile.legalForm,
    foundedYear: profile.foundedYear,
    employeeCount: profile.employeeCount,
    description: profile.description,
    certifications: profile.certifications.map((c) => ({
      id: c.id,
      name: c.name,
      issuer: c.issuer,
      certificateNumber: c.certificateNumber,
      issuedAt: c.issuedAt,
      expiresAt: c.expiresAt,
    })),
    revenueYears: profile.revenueYears
      .map((r) => ({ id: r.id, year: r.year, amount: decryptAmount(r.amountEncrypted), currency: r.currency }))
      .sort((a, b) => b.year - a.year),
    references: profile.references.map((r) => ({
      id: r.id,
      title: r.title,
      clientName: r.clientName,
      description: r.description,
      amount: r.amountEncrypted ? decryptAmount(r.amountEncrypted) : null,
      currency: r.currency,
      startDate: r.startDate,
      endDate: r.endDate,
      sector: r.sector,
    })),
    teamMembers: profile.teamMembers.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      yearsExperience: m.yearsExperience,
      qualifications: m.qualifications,
    })),
  };
}

/** Vista aplanada/descifrada apta para el motor de cruce (src/server/eligibility). */
export async function getProfileForEligibility(
  profileId: string,
  organizationId: string
): Promise<EligibilityCompanyProfile | null> {
  const profile = await prisma.companyProfile.findFirst({
    where: { id: profileId, organizationId },
    include: { certifications: true, revenueYears: true, references: true, teamMembers: true },
  });
  if (!profile) return null;

  return {
    foundedYear: profile.foundedYear,
    certifications: profile.certifications.map((c) => ({ name: c.name, expiresAt: c.expiresAt })),
    revenueYears: profile.revenueYears.map((r) => ({ year: r.year, amount: decryptAmount(r.amountEncrypted) })),
    references: profile.references.map((r) => ({
      title: r.title,
      sector: r.sector,
      amount: r.amountEncrypted ? decryptAmount(r.amountEncrypted) : null,
      startDate: r.startDate,
      endDate: r.endDate,
    })),
    teamMembers: profile.teamMembers.map((m) => ({ role: m.role, yearsExperience: m.yearsExperience })),
  };
}

export async function updateProfileBasicInfo(
  profileId: string,
  organizationId: string,
  data: {
    name: string;
    taxId?: string | null;
    legalForm?: string | null;
    foundedYear?: number | null;
    employeeCount?: number | null;
    description?: string | null;
  }
) {
  await prisma.companyProfile.updateMany({
    where: { id: profileId, organizationId },
    data: {
      name: data.name,
      taxIdEncrypted: data.taxId ? encryptField(data.taxId) : data.taxId === null ? null : undefined,
      legalForm: data.legalForm,
      foundedYear: data.foundedYear,
      employeeCount: data.employeeCount,
      description: data.description,
    },
  });
}

async function assertOwnedProfile(profileId: string, organizationId: string) {
  const profile = await prisma.companyProfile.findFirst({ where: { id: profileId, organizationId }, select: { id: true } });
  if (!profile) throw new Error("Perfil de empresa no encontrado o no pertenece a esta organización.");
}

export async function addCertification(
  profileId: string,
  organizationId: string,
  data: { name: string; issuer?: string | null; certificateNumber?: string | null; issuedAt?: Date | null; expiresAt?: Date | null }
) {
  await assertOwnedProfile(profileId, organizationId);
  return prisma.certification.create({ data: { companyProfileId: profileId, ...data } });
}

export async function updateCertification(
  certificationId: string,
  profileId: string,
  organizationId: string,
  data: { name: string; issuer?: string | null; certificateNumber?: string | null; issuedAt?: Date | null; expiresAt?: Date | null }
) {
  await assertOwnedProfile(profileId, organizationId);
  await prisma.certification.updateMany({ where: { id: certificationId, companyProfileId: profileId }, data });
}

export async function deleteCertification(certificationId: string, profileId: string, organizationId: string) {
  await assertOwnedProfile(profileId, organizationId);
  await prisma.certification.deleteMany({ where: { id: certificationId, companyProfileId: profileId } });
}

export async function upsertRevenueYear(
  profileId: string,
  organizationId: string,
  data: { year: number; amount: number; currency?: string }
) {
  await assertOwnedProfile(profileId, organizationId);
  const amountEncrypted = encryptAmount(data.amount);
  await prisma.revenueYear.upsert({
    where: { companyProfileId_year: { companyProfileId: profileId, year: data.year } },
    create: { companyProfileId: profileId, year: data.year, amountEncrypted, currency: data.currency ?? "EUR" },
    update: { amountEncrypted, currency: data.currency ?? "EUR" },
  });
}

export async function deleteRevenueYear(revenueYearId: string, profileId: string, organizationId: string) {
  await assertOwnedProfile(profileId, organizationId);
  await prisma.revenueYear.deleteMany({ where: { id: revenueYearId, companyProfileId: profileId } });
}

export async function addReference(
  profileId: string,
  organizationId: string,
  data: {
    title: string;
    clientName: string;
    description?: string | null;
    amount?: number | null;
    currency?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    sector?: string | null;
  }
) {
  await assertOwnedProfile(profileId, organizationId);
  return prisma.experienceReference.create({
    data: {
      companyProfileId: profileId,
      title: data.title,
      clientName: data.clientName,
      description: data.description,
      amountEncrypted: data.amount != null ? encryptAmount(data.amount) : null,
      currency: data.currency ?? "EUR",
      startDate: data.startDate,
      endDate: data.endDate,
      sector: data.sector,
    },
  });
}

export async function deleteReference(referenceId: string, profileId: string, organizationId: string) {
  await assertOwnedProfile(profileId, organizationId);
  await prisma.experienceReference.deleteMany({ where: { id: referenceId, companyProfileId: profileId } });
}

export async function addTeamMember(
  profileId: string,
  organizationId: string,
  data: { name: string; role: string; yearsExperience?: number | null; qualifications?: string | null }
) {
  await assertOwnedProfile(profileId, organizationId);
  return prisma.teamMember.create({ data: { companyProfileId: profileId, ...data } });
}

export async function deleteTeamMember(teamMemberId: string, profileId: string, organizationId: string) {
  await assertOwnedProfile(profileId, organizationId);
  await prisma.teamMember.deleteMany({ where: { id: teamMemberId, companyProfileId: profileId } });
}
