import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { extractTenderFunction } from "@/inngest/functions/extract-tender";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [extractTenderFunction],
});
