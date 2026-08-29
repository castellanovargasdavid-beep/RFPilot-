import { describe, expect, it } from "vitest";

import { verifyCitation } from "./verify-citation";
import type { StructuralBlock } from "./structural-extract";

function block(overrides: Partial<StructuralBlock>): StructuralBlock {
  return {
    pagina: 1,
    clausula: null,
    parrafo: 0,
    text: "",
    bboxX: 0.1,
    bboxY: 0.1,
    bboxW: 0.5,
    bboxH: 0.05,
    order: 0,
    esTabla: false,
    ...overrides,
  };
}

describe("verifyCitation", () => {
  it("verifica una cita que coincide textualmente (ignorando mayúsculas/acentos)", () => {
    const blocks = [block({ pagina: 7, text: "El licitador deberá acreditar la posesión del certificado ISO 9001 vigente." })];
    const result = verifyCitation("posesión del certificado ISO 9001 vigente", 7, blocks);
    expect(result.verified).toBe(true);
    expect(result.similarity).toBe(1);
    expect(result.matchedBlock).not.toBeNull();
  });

  it("verifica una cita con pequeñas diferencias tipográficas (fuzzy match)", () => {
    const blocks = [
      block({ pagina: 3, text: "Se exige una facturación mínima de 480.000 euros en los últimos tres ejercicios económicos." }),
    ];
    // Cita con un error de transcripción menor ("euros" -> "eur"), sigue por encima del umbral.
    const result = verifyCitation("facturación mínima de 480.000 eur en los últimos tres ejercicios", 3, blocks);
    expect(result.verified).toBe(true);
  });

  it("NO verifica una cita inventada que no aparece en la página", () => {
    const blocks = [block({ pagina: 2, text: "El objeto del contrato es el mantenimiento de sistemas informáticos municipales." })];
    const result = verifyCitation("se requiere estar en posesión del certificado ISO 27001", 2, blocks);
    expect(result.verified).toBe(false);
    expect(result.matchedBlock).toBeNull();
  });

  it("NO verifica una cita real pero en la página equivocada", () => {
    const blocks = [
      block({ pagina: 5, text: "Certificado ISO 27001 vigente, expedido por entidad acreditada por ENAC." }),
      block({ pagina: 9, text: "El plazo de presentación de ofertas finaliza el día indicado en el anuncio de licitación." }),
    ];
    const result = verifyCitation("Certificado ISO 27001 vigente, expedido por entidad acreditada por ENAC", 9, blocks);
    expect(result.verified).toBe(false);
  });

  it("encuentra una cita que queda partida entre dos párrafos consecutivos", () => {
    const blocks = [
      block({ pagina: 4, parrafo: 0, text: "El licitador deberá contar con un seguro de responsabilidad civil" }),
      block({ pagina: 4, parrafo: 1, text: "con un límite mínimo de 600.000 euros por siniestro." }),
    ];
    const result = verifyCitation(
      "un seguro de responsabilidad civil con un límite mínimo de 600.000 euros",
      4,
      blocks
    );
    expect(result.verified).toBe(true);
  });

  it("no verifica nada si no hay bloques para esa página (p.ej. documento sin indexación estructural)", () => {
    const result = verifyCitation("cualquier cosa", 3, []);
    expect(result.verified).toBe(false);
    expect(result.similarity).toBe(0);
  });
});
