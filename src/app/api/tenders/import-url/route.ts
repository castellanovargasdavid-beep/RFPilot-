import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiMembership } from "@/server/auth/session";
import { isBlobConfigured } from "@/server/storage";
import { saveLocalFile } from "@/server/storage/local";
import { assertPublicHttpUrl, UnsafeUrlError } from "@/server/security/ssrf";
import { MAX_TENDER_FILE_SIZE_BYTES } from "@/lib/tender-constraints";

const bodySchema = z.object({ url: z.string().min(1).max(2000) });

const FETCH_TIMEOUT_MS = 30_000;
const PDF_MAGIC_BYTES = Buffer.from("%PDF-");

function fileNameFromUrl(url: URL): string {
  const last = url.pathname.split("/").filter(Boolean).pop();
  if (last && last.toLowerCase().endsWith(".pdf")) return last;
  return "pliego-importado.pdf";
}

/**
 * "Importar por URL" — para pegar el enlace directo a un PCAP/PPT de la
 * PLACSP (o cualquier otro portal de contratación) en vez de tener que
 * descargarlo a mano y volver a subirlo. No es una integración con la API
 * de la PLACSP (eso implicaría poder buscar/navegar expedientes desde
 * dentro de RFPilot, un proyecto aparte) — aquí solo se acepta un enlace
 * directo al PDF y el servidor lo descarga por el usuario.
 *
 * Nunca sigue redirects automáticamente ni confía en la URL a ciegas: ver
 * src/server/security/ssrf.ts.
 */
export async function POST(request: Request) {
  const membership = await getApiMembership();
  if (!membership) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  let url: URL;
  try {
    url = await assertPublicHttpUrl(parsed.data.url);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json({ error: "unsafe_url", message: error.message }, { status: 400 });
    }
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { redirect: "manual", signal: controller.signal });
  } catch {
    clearTimeout(timeout);
    return NextResponse.json({ error: "fetch_failed", message: "No se pudo descargar el archivo de esa URL." }, { status: 400 });
  }
  clearTimeout(timeout);

  if (res.status >= 300 && res.status < 400) {
    return NextResponse.json(
      { error: "redirect_not_allowed", message: "Esa URL redirige a otra dirección — pega el enlace directo al PDF." },
      { status: 400 }
    );
  }
  if (!res.ok) {
    return NextResponse.json({ error: "fetch_failed", message: `El servidor respondió con un error (HTTP ${res.status}).` }, { status: 400 });
  }

  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_TENDER_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength > MAX_TENDER_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }
  if (!buffer.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES)) {
    return NextResponse.json(
      { error: "not_a_pdf", message: "El contenido descargado no es un PDF válido." },
      { status: 400 }
    );
  }

  const fileName = fileNameFromUrl(url);

  let fileUrl: string;
  if (isBlobConfigured()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`tenders/${membership.organizationId}/${Date.now()}-${fileName}`, buffer, {
      access: "public",
      contentType: "application/pdf",
    });
    fileUrl = blob.url;
  } else {
    fileUrl = (await saveLocalFile(membership.organizationId, fileName, buffer)).url;
  }

  return NextResponse.json({ url: fileUrl, fileName, fileSizeBytes: buffer.byteLength });
}
