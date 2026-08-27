import { describe, expect, it } from "vitest";

import { inferLegacyCategory } from "./requirement-mapping";

describe("inferLegacyCategory", () => {
  it("SOLVENCIA_ECONOMICA -> FINANCIAL", () => {
    expect(inferLegacyCategory("SOLVENCIA_ECONOMICA", "Facturación mínima de 300.000€", "")).toBe("FINANCIAL");
  });

  it("PROHIBICION_CONTRATAR -> LEGAL_ADMINISTRATIVE", () => {
    expect(inferLegacyCategory("PROHIBICION_CONTRATAR", "No estar incurso en causa de prohibición de contratar", "")).toBe(
      "LEGAL_ADMINISTRATIVE"
    );
  });

  it("HABILITACION_EMPRESARIAL sin código de norma -> LEGAL_ADMINISTRATIVE", () => {
    expect(inferLegacyCategory("HABILITACION_EMPRESARIAL", "Estar dado de alta en el epígrafe correspondiente", "")).toBe(
      "LEGAL_ADMINISTRATIVE"
    );
  });

  it("HABILITACION_EMPRESARIAL con código de norma reconocible -> CERTIFICATION", () => {
    expect(inferLegacyCategory("HABILITACION_EMPRESARIAL", "Estar clasificado según ISO 9001", "")).toBe("CERTIFICATION");
  });

  it("SOLVENCIA_TECNICA con código de norma (ISO/UNE/ENS) -> CERTIFICATION, igual que la extracción anterior", () => {
    expect(inferLegacyCategory("SOLVENCIA_TECNICA", "Certificado ISO/IEC 27001 vigente", "")).toBe("CERTIFICATION");
    expect(inferLegacyCategory("SOLVENCIA_TECNICA", "", "conforme a la norma UNE 166002")).toBe("CERTIFICATION");
  });

  it("SOLVENCIA_TECNICA sobre el equipo -> TEAM_QUALIFICATION", () => {
    expect(inferLegacyCategory("SOLVENCIA_TECNICA", "El jefe de proyecto deberá acreditar 5 años de experiencia", "")).toBe(
      "TEAM_QUALIFICATION"
    );
  });

  it("SOLVENCIA_TECNICA genérica (experiencia previa, referencias) -> TECHNICAL_EXPERIENCE", () => {
    expect(inferLegacyCategory("SOLVENCIA_TECNICA", "Al menos 2 contratos similares en los últimos 3 años", "")).toBe(
      "TECHNICAL_EXPERIENCE"
    );
  });
});
