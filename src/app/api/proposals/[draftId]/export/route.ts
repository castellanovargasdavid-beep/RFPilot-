import { NextResponse } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";

import { getApiMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { proposalDraftInclude } from "@/server/proposals/detail-select";
import { buildProposalDocx } from "@/server/proposals/export-docx";
import { buildProposalPdf } from "@/server/proposals/export-pdf";
import { isBlobConfigured } from "@/server/storage";
import { saveLocalFile } from "@/server/storage/local";

const schema = z.object({ format: z.enum(["DOCX", "PDF"]) });

const CONTENT_TYPES = {
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  PDF: "application/pdf",
};

export async function POST(request: Request, { params }: { params: { draftId: string } }) {
  const membership = await getApiMembership();
  if (!membership) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const draft = await prisma.proposalDraft.findFirst({
    where: { id: params.draftId, tender: { organizationId: membership.organizationId } },
    include: proposalDraftInclude,
  });
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { format } = parsed.data;
  const buffer = format === "DOCX" ? await buildProposalDocx(draft) : await buildProposalPdf(draft);
  const extension = format === "DOCX" ? "docx" : "pdf";
  const fileName = `${draft.title.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 100)}.${extension}`;

  const fileUrl = isBlobConfigured()
    ? (await put(`proposals/${draft.id}/${Date.now()}-${fileName}`, buffer, { access: "public", contentType: CONTENT_TYPES[format] })).url
    : (await saveLocalFile(membership.organizationId, fileName, buffer)).url;

  await prisma.proposalExport.create({ data: { draftId: draft.id, format, fileUrl } });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
