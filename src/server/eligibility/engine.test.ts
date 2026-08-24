import { describe, expect, it } from "vitest";
import { evaluateAllRequirements, evaluateRequirement, rollupEligibility } from "./engine";
import type { EligibilityCompanyProfile, EligibilityContext, EligibilityRequirement } from "./types";

const context: EligibilityContext = { submissionDeadline: new Date("2026-12-01") };

function req(overrides: Partial<EligibilityRequirement>): EligibilityRequirement {
  return {
    id: "req-1",
    category: "OTHER",
    description: "",
    citationText: null,
    isMandatory: true,
    ...overrides,
  };
}

const emptyProfile: EligibilityCompanyProfile = {
  foundedYear: null,
  certifications: [],
  revenueYears: [],
  references: [],
  teamMembers: [],
};

describe("evaluateRequirement — CERTIFICATION", () => {
  it("GREEN cuando la empresa tiene la certificación exigida y vigente", () => {
    const profile: EligibilityCompanyProfile = {
      ...emptyProfile,
      certifications: [{ name: "ISO 9001:2015", expiresAt: new Date("2027-01-01") }],
    };
    const result = evaluateRequirement(
      req({ category: "CERTIFICATION", description: "Estar en posesión del certificado ISO 9001 vigente" }),
      profile,
      context
    );
    expect(result.status).toBe("GREEN");
    expect(result.matchedProfileFact).toBe("ISO 9001:2015");
  });

  it("RED cuando la empresa no tiene ninguna certificación que coincida", () => {
    const profile: EligibilityCompanyProfile = {
      ...emptyProfile,
      certifications: [{ name: "ISO 14001", expiresAt: new Date("2027-01-01") }],
    };
    const result = evaluateRequirement(
      req({ category: "CERTIFICATION", description: "Estar en posesión del certificado ISO 27001 vigente" }),
      profile,
      context
    );
    expect(result.status).toBe("RED");
  });

  it("AMBER cuando la certificación existe pero caduca antes de la fecha límite", () => {
    const profile: EligibilityCompanyProfile = {
      ...emptyProfile,
      certifications: [{ name: "ISO 9001", expiresAt: new Date("2026-06-01") }],
    };
    const result = evaluateRequirement(
      req({ category: "CERTIFICATION", description: "Certificado ISO 9001 en vigor" }),
      profile,
      context
    );
    expect(result.status).toBe("AMBER");
    expect(result.reasoning).toContain("caduca");
  });

  it("GREEN por coincidencia de nombre libre cuando no hay código ISO en el texto", () => {
    const profile: EligibilityCompanyProfile = {
      ...emptyProfile,
      certifications: [{ name: "Esquema Nacional de Seguridad (ENS)", expiresAt: null }],
    };
    const result = evaluateRequirement(
      req({ category: "CERTIFICATION", description: "Certificación en el Esquema Nacional de Seguridad" }),
      profile,
      context
    );
    expect(result.status).toBe("GREEN");
  });
});

describe("evaluateRequirement — FINANCIAL", () => {
  it("GREEN cuando la facturación media supera el umbral exigido", () => {
    const profile: EligibilityCompanyProfile = {
      ...emptyProfile,
      revenueYears: [
        { year: 2023, amount: 600_000 },
        { year: 2024, amount: 700_000 },
        { year: 2025, amount: 800_000 },
      ],
    };
    const result = evaluateRequirement(
      req({ category: "FINANCIAL", description: "Facturación media mínima de 500.000 € en los últimos 3 años" }),
      profile,
      context
    );
    expect(result.status).toBe("GREEN");
  });

  it("RED cuando la facturación media no alcanza el umbral exigido (caso crítico: nunca debe dar GREEN)", () => {
    const profile: EligibilityCompanyProfile = {
      ...emptyProfile,
      revenueYears: [
        { year: 2023, amount: 100_000 },
        { year: 2024, amount: 120_000 },
      ],
    };
    const result = evaluateRequirement(
      req({ category: "FINANCIAL", description: "Facturación media mínima de 500.000 € en los últimos 3 años" }),
      profile,
      context
    );
    expect(result.status).toBe("RED");
  });

  it("AMBER cuando no se puede determinar el importe exigido", () => {
    const result = evaluateRequirement(
      req({ category: "FINANCIAL", description: "Acreditar solvencia económica suficiente" }),
      emptyProfile,
      context
    );
    expect(result.status).toBe("AMBER");
  });

  it("AMBER cuando no hay datos de facturación en el perfil, nunca GREEN ni RED por defecto", () => {
    const result = evaluateRequirement(
      req({ category: "FINANCIAL", description: "Facturación mínima de 200.000 €" }),
      emptyProfile,
      context
    );
    expect(result.status).toBe("AMBER");
  });
});

describe("evaluateRequirement — TECHNICAL_EXPERIENCE", () => {
  it("GREEN cuando el número de referencias cubre el mínimo exigido", () => {
    const profile: EligibilityCompanyProfile = {
      ...emptyProfile,
      references: [
        { title: "A", sector: null, amount: null, startDate: null, endDate: null },
        { title: "B", sector: null, amount: null, startDate: null, endDate: null },
      ],
    };
    const result = evaluateRequirement(
      req({ category: "TECHNICAL_EXPERIENCE", description: "Haber ejecutado al menos 2 contratos similares" }),
      profile,
      context
    );
    expect(result.status).toBe("GREEN");
  });

  it("RED cuando el número de referencias no cubre el mínimo exigido", () => {
    const result = evaluateRequirement(
      req({ category: "TECHNICAL_EXPERIENCE", description: "Haber ejecutado al menos 3 contratos similares" }),
      emptyProfile,
      context
    );
    expect(result.status).toBe("RED");
  });

  it("GREEN cuando la experiencia del equipo cubre los años exigidos", () => {
    const profile: EligibilityCompanyProfile = {
      ...emptyProfile,
      teamMembers: [{ role: "Jefe de proyecto", yearsExperience: 8 }],
    };
    const result = evaluateRequirement(
      req({ category: "TECHNICAL_EXPERIENCE", description: "Mínimo 5 años de experiencia en el sector" }),
      profile,
      context
    );
    expect(result.status).toBe("GREEN");
  });

  it("AMBER (no RED) cuando la experiencia detectada no alcanza el mínimo — evita falso negativo duro", () => {
    const profile: EligibilityCompanyProfile = { ...emptyProfile, foundedYear: 2024 };
    const result = evaluateRequirement(
      req({ category: "TECHNICAL_EXPERIENCE", description: "Mínimo 10 años de experiencia en el sector" }),
      profile,
      context
    );
    expect(result.status).toBe("AMBER");
  });
});

describe("evaluateRequirement — TEAM_QUALIFICATION", () => {
  it("GREEN cuando un miembro del equipo cubre los años exigidos", () => {
    const profile: EligibilityCompanyProfile = {
      ...emptyProfile,
      teamMembers: [{ role: "Ingeniero senior", yearsExperience: 6 }],
    };
    const result = evaluateRequirement(
      req({ category: "TEAM_QUALIFICATION", description: "Técnico con al menos 5 años de experiencia" }),
      profile,
      context
    );
    expect(result.status).toBe("GREEN");
  });

  it("AMBER cuando ningún miembro cubre los años exigidos", () => {
    const profile: EligibilityCompanyProfile = {
      ...emptyProfile,
      teamMembers: [{ role: "Junior", yearsExperience: 1 }],
    };
    const result = evaluateRequirement(
      req({ category: "TEAM_QUALIFICATION", description: "Técnico con al menos 5 años de experiencia" }),
      profile,
      context
    );
    expect(result.status).toBe("AMBER");
  });
});

describe("evaluateRequirement — categorías sin verificación automática", () => {
  it.each(["LEGAL_ADMINISTRATIVE", "INSURANCE", "OTHER"] as const)(
    "%s siempre da AMBER, nunca GREEN por defecto",
    (category) => {
      const result = evaluateRequirement(req({ category, description: "Cualquier cosa" }), emptyProfile, context);
      expect(result.status).toBe("AMBER");
    }
  );
});

describe("rollupEligibility", () => {
  it("RED si algún requisito obligatorio es RED, aunque el resto sean GREEN", () => {
    const requirements = [
      req({ id: "a", isMandatory: true }),
      req({ id: "b", isMandatory: true }),
    ];
    const results = [
      { requirementId: "a", status: "GREEN" as const, reasoning: "", matchedProfileFact: null },
      { requirementId: "b", status: "RED" as const, reasoning: "", matchedProfileFact: null },
    ];
    expect(rollupEligibility(results, requirements).status).toBe("RED");
  });

  it("AMBER si no hay ningún RED pero sí algún AMBER", () => {
    const requirements = [req({ id: "a", isMandatory: true }), req({ id: "b", isMandatory: true })];
    const results = [
      { requirementId: "a", status: "GREEN" as const, reasoning: "", matchedProfileFact: null },
      { requirementId: "b", status: "AMBER" as const, reasoning: "", matchedProfileFact: null },
    ];
    expect(rollupEligibility(results, requirements).status).toBe("AMBER");
  });

  it("GREEN solo si todos los obligatorios son GREEN", () => {
    const requirements = [req({ id: "a", isMandatory: true }), req({ id: "b", isMandatory: true })];
    const results = [
      { requirementId: "a", status: "GREEN" as const, reasoning: "", matchedProfileFact: null },
      { requirementId: "b", status: "GREEN" as const, reasoning: "", matchedProfileFact: null },
    ];
    expect(rollupEligibility(results, requirements).status).toBe("GREEN");
  });

  it("ignora los requisitos no obligatorios para el semáforo global", () => {
    const requirements = [
      req({ id: "a", isMandatory: true }),
      req({ id: "b", isMandatory: false }),
    ];
    const results = [
      { requirementId: "a", status: "GREEN" as const, reasoning: "", matchedProfileFact: null },
      { requirementId: "b", status: "RED" as const, reasoning: "", matchedProfileFact: null },
    ];
    expect(rollupEligibility(results, requirements).status).toBe("GREEN");
  });

  it("calcula un score proporcional a los GREEN/AMBER", () => {
    const requirements = [req({ id: "a", isMandatory: true }), req({ id: "b", isMandatory: true })];
    const results = [
      { requirementId: "a", status: "GREEN" as const, reasoning: "", matchedProfileFact: null },
      { requirementId: "b", status: "AMBER" as const, reasoning: "", matchedProfileFact: null },
    ];
    expect(rollupEligibility(results, requirements).score).toBe(75);
  });
});

describe("evaluateAllRequirements", () => {
  it("evalúa cada requisito de forma independiente y devuelve un resultado por cada uno", () => {
    const requirements = [
      req({ id: "a", category: "CERTIFICATION", description: "ISO 9001" }),
      req({ id: "b", category: "OTHER", description: "Declaración responsable" }),
    ];
    const results = evaluateAllRequirements(requirements, emptyProfile, context);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.requirementId)).toEqual(["a", "b"]);
  });
});
