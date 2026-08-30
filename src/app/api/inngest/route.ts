import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { extractTenderFunction } from "@/inngest/functions/extract-tender";
import { analyzeTenderFunction } from "@/inngest/functions/analyze-tender";
import { generateProposalOutlineFunction } from "@/inngest/functions/generate-proposal-outline";
import { generateProposalSectionFunction } from "@/inngest/functions/generate-proposal-section";

/**
 * Por defecto Vercel corta esta función a los pocos segundos (10s en plan
 * Hobby). Un pliego grande escaneado puede tardar varios minutos en OCR
 * (hasta MAX_OCR_PAGES páginas, ver src/server/pdf/ocr.ts) — sin este
 * límite ampliado, la función se mata a mitad de proceso y la licitación
 * se queda "atascada" indefinidamente en cada reintento.
 * En plan Hobby, Vercel ignora este valor y sigue aplicando su propio tope;
 * en Pro/Enterprise amplía el límite real hasta el máximo permitido por tu
 * plan (habitualmente 300s en Pro).
 */
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    extractTenderFunction,
    analyzeTenderFunction,
    generateProposalOutlineFunction,
    generateProposalSectionFunction,
  ],
});
