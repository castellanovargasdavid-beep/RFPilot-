import { describe, expect, it } from "vitest";
import { extractMoneyThreshold } from "./money";

describe("extractMoneyThreshold", () => {
  it("parsea un importe con separador de miles con punto", () => {
    expect(extractMoneyThreshold("una facturación mínima de 500.000 € en los últimos tres años")).toBe(500_000);
  });

  it("parsea un importe seguido de 'euros'", () => {
    expect(extractMoneyThreshold("Volumen de negocio superior a 250.000 euros")).toBe(250_000);
  });

  it("parsea un importe seguido de 'EUR'", () => {
    expect(extractMoneyThreshold("Presupuesto base de licitación: 1.200.000 EUR")).toBe(1_200_000);
  });

  it("parsea millones con decimales en coma", () => {
    expect(extractMoneyThreshold("una cifra de negocios de 1,5 millones de euros")).toBe(1_500_000);
  });

  it("parsea millones sin decimales", () => {
    expect(extractMoneyThreshold("importe superior a 2 millones €")).toBe(2_000_000);
  });

  it("parsea 'mil' como multiplicador", () => {
    expect(extractMoneyThreshold("solvencia económica de 50 mil euros")).toBe(50_000);
  });

  it("devuelve el importe más alto cuando hay varias cifras", () => {
    expect(
      extractMoneyThreshold("el presupuesto es de 100.000 € y se exige una facturación mínima de 300.000 €")
    ).toBe(300_000);
  });

  it("devuelve null si no hay ningún importe reconocible", () => {
    expect(extractMoneyThreshold("el licitador debe estar al corriente de sus obligaciones tributarias")).toBeNull();
  });

  it("devuelve null ante un número sin marcador de divisa", () => {
    expect(extractMoneyThreshold("el contrato tiene una duración de 24 meses")).toBeNull();
  });
});
