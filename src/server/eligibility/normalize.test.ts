import { describe, expect, it } from "vitest";
import {
  containsNormalized,
  extractReferenceCountRequirement,
  extractStandardCodes,
  extractYearsRequirement,
  normalizeText,
} from "./normalize";

describe("normalizeText", () => {
  it("quita acentos y pasa a minúsculas", () => {
    expect(normalizeText("Certificación ISO")).toBe("certificacion iso");
  });

  it("colapsa espacios múltiples", () => {
    expect(normalizeText("hola   mundo\n\ncómo estás")).toBe("hola mundo como estas");
  });
});

describe("containsNormalized", () => {
  it("encuentra una coincidencia ignorando mayúsculas y acentos", () => {
    expect(containsNormalized("Se exige estar en posesión del certificado ISO 9001", "iso 9001")).toBe(true);
  });

  it("no encuentra coincidencia si el texto no aparece", () => {
    expect(containsNormalized("Se exige experiencia previa", "iso 27001")).toBe(false);
  });
});

describe("extractStandardCodes", () => {
  it("extrae un código ISO simple", () => {
    expect(extractStandardCodes("Certificación ISO 9001 vigente")).toEqual(["iso9001"]);
  });

  it("extrae ISO/IEC con barra", () => {
    expect(extractStandardCodes("ISO/IEC 27001 de seguridad de la información")).toEqual(["isoiec27001"]);
  });

  it("reconoce el Esquema Nacional de Seguridad sin número", () => {
    expect(extractStandardCodes("certificación en el Esquema Nacional de Seguridad")).toEqual(["ens"]);
  });

  it("devuelve varios códigos si hay varios en el texto", () => {
    expect(extractStandardCodes("se exige ISO 9001 e ISO 14001")).toEqual(["iso9001", "iso14001"]);
  });

  it("devuelve un array vacío si no hay ningún código", () => {
    expect(extractStandardCodes("experiencia previa en proyectos similares")).toEqual([]);
  });
});

describe("extractYearsRequirement", () => {
  it("extrae un número de años simple", () => {
    expect(extractYearsRequirement("al menos 3 años de experiencia en el sector")).toBe(3);
  });

  it("devuelve el mayor número de años cuando hay varios", () => {
    expect(extractYearsRequirement("mínimo 2 años, preferiblemente 5 años")).toBe(5);
  });

  it("devuelve null si no hay ninguna mención a años", () => {
    expect(extractYearsRequirement("se exige experiencia demostrable")).toBeNull();
  });
});

describe("extractReferenceCountRequirement", () => {
  it("extrae un número de contratos similares", () => {
    expect(extractReferenceCountRequirement("haber ejecutado al menos 2 contratos similares")).toBe(2);
  });

  it("extrae un número de referencias", () => {
    expect(extractReferenceCountRequirement("aportar 3 referencias de clientes anteriores")).toBe(3);
  });

  it("devuelve null si no hay ningún número de referencias", () => {
    expect(extractReferenceCountRequirement("experiencia acreditada en el sector")).toBeNull();
  });
});
