import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { extractTenderFunction } from "@/inngest/functions/extract-tender";
import { analyzeTenderFunction } from "@/inngest/functions/analyze-tender";
import { generateProposalOutlineFunction } from "@/inngest/functions/generate-proposal-outline";
import { generateProposalSectionFunction } from "@/inngest/functions/generate-proposal-section";

/**
 * Por defecto Vercel corta esta función a los pocos segundos. 60s es el
 * máximo permitido en plan Hobby (Vercel rechaza el build si se pide más);
 * en Pro/Enterprise se puede subir hasta 300s. Por eso ningún paso
 * individual de esta función puede tardar más de ~60s — ver el OCR
 * troceado por página en src/inngest/functions/extract-tender.ts, que
 * existe precisamente para encajar en este límite.
 */
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    extractTenderFunction,
    analyzeTenderFunction,
    generateProposalOutlineFunction,
    generateProposalSectionFunction,
  ],
});
