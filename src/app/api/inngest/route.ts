import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { extractTenderFunction } from "@/inngest/functions/extract-tender";
import { analyzeTenderFunction } from "@/inngest/functions/analyze-tender";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [extractTenderFunction, analyzeTenderFunction],
});
