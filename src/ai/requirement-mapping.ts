import type { RequirementCategory } from "@prisma/client";

import { extractStandardCodes, normalizeText } from "@/server/eligibility/normalize";
import type { PcapRequirementType } from "./schemas/pcap-extraction";

/**
 * `tipo` (SOLVENCIA_ECONOMICA/SOLVENCIA_TECNICA/HABILITACION_EMPRESARIAL/
 * PROHIBICION_CONTRATAR) es la taxonomía jurídica exacta que exponemos a
 * Claude y al usuario. `RequirementCategory` (CERTIFICATION/FINANCIAL/...)
 * sigue siendo la clave de despacho interna del motor de cruce
 * (src/server/eligibility/engine.ts) — NUNCA se toca directamente, para no
 * arriesgar la lógica de negocio más crítica del producto ni sus 47 tests.
 * Esta función deriva una de la otra, de forma determinista, al persistir.
 *
 * El caso delicado es SOLVENCIA_TECNICA/HABILITACION_EMPRESARIAL: en la
 * práctica española una ISO 9001/27001 se describe a veces como solvencia
 * técnica y a veces como habilitación/clasificación — en ambos casos, si el
 * texto menciona un código de norma reconocible (ISO/UNE/ENS), lo enrutamos
 * al matcher de certificaciones (el más preciso), igual que hacía la
 * extracción anterior con la categoría CERTIFICATION.
 */
export function inferLegacyCategory(tipo: PcapRequirementType, descripcion: string, citaLiteral: string): RequirementCategory {
  const text = `${descripcion} ${citaLiteral}`;

  switch (tipo) {
    case "SOLVENCIA_ECONOMICA":
      return "FINANCIAL";
    case "PROHIBICION_CONTRATAR":
      return "LEGAL_ADMINISTRATIVE";
    case "HABILITACION_EMPRESARIAL":
      return extractStandardCodes(text).length > 0 ? "CERTIFICATION" : "LEGAL_ADMINISTRATIVE";
    case "SOLVENCIA_TECNICA": {
      if (extractStandardCodes(text).length > 0) return "CERTIFICATION";
      if (/\b(equipo|personal tecnico|titulacion|responsable del proyecto|jefe de proyecto)\b/.test(normalizeText(text))) {
        return "TEAM_QUALIFICATION";
      }
      return "TECHNICAL_EXPERIENCE";
    }
    default:
      return "OTHER";
  }
}
