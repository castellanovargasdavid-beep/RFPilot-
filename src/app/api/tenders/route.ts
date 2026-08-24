import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { MAX_TENDER_FILE_SIZE_BYTES } from "@/lib/tender-constraints";

const createTenderSchema = z.object({
  title: z.string().min(2).max(300),
  fileUrl: z.string().min(1),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().positive().max(MAX_TENDER_FILE_SIZE_BYTES),
  sourceType: z.enum(["PUBLIC_TENDER", "CORPORATE_RFP"]).default("PUBLIC_TENDER"),
  contractingBody: z.string().max(300).optional(),
  clientId: z.string().optional(),
});

export async function POST(request: Request) {
  const [membership, session] = await Promise.all([getApiMembership(), auth()]);
  if (!membership || !session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createTenderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { title, fileUrl, fileName, fileSizeBytes, sourceType, contractingBody, clientId } = parsed.data;

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: membership.organizationId },
    });
    if (!client) {
      return NextResponse.json({ error: "invalid_client" }, { status: 400 });
    }
  }

  const tender = await prisma.tender.create({
    data: {
      organizationId: membership.organizationId,
      clientId: clientId ?? null,
      uploadedById: session.user.id,
      title,
      sourceType,
      contractingBody,
      fileUrl,
      fileName,
      fileSizeBytes,
      status: "UPLOADING",
    },
  });

  await inngest.send({ name: "tender/uploaded", data: { tenderId: tender.id } });

  return NextResponse.json({ id: tender.id });
}
