import type { CompanyProfileView } from "./repository";

function formatEur(n: number, currency: string): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

/** Resumen en texto plano del perfil de empresa, para inyectar en prompts de generación de contenido. */
export function summarizeProfileForPrompt(profile: CompanyProfileView): string {
  const lines: string[] = [];

  lines.push(`Empresa: ${profile.name}${profile.legalForm ? ` (${profile.legalForm})` : ""}`);
  if (profile.foundedYear) lines.push(`Fundada en ${profile.foundedYear}.`);
  if (profile.employeeCount) lines.push(`${profile.employeeCount} empleados.`);
  if (profile.description) lines.push(`Actividad: ${profile.description}`);

  if (profile.certifications.length > 0) {
    lines.push(`Certificaciones: ${profile.certifications.map((c) => c.name).join(", ")}.`);
  }

  if (profile.revenueYears.length > 0) {
    const revenueList = profile.revenueYears.map((r) => `${r.year}: ${formatEur(r.amount, r.currency)}`).join(", ");
    lines.push(`Facturación por ejercicio: ${revenueList}.`);
  }

  if (profile.references.length > 0) {
    lines.push("Referencias/proyectos previos:");
    for (const ref of profile.references) {
      const parts = [ref.title, `cliente: ${ref.clientName}`];
      if (ref.sector) parts.push(`sector: ${ref.sector}`);
      if (ref.amount != null) parts.push(`importe: ${formatEur(ref.amount, ref.currency)}`);
      lines.push(`- ${parts.join(" — ")}${ref.description ? `. ${ref.description}` : ""}`);
    }
  }

  if (profile.teamMembers.length > 0) {
    const teamList = profile.teamMembers
      .map((m) => `${m.name} (${m.role}${m.yearsExperience != null ? `, ${m.yearsExperience} años de experiencia` : ""})`)
      .join(", ");
    lines.push(`Equipo técnico: ${teamList}.`);
  }

  return lines.join("\n");
}
