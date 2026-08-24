import { TenderUploadForm } from "@/components/tenders/upload-form";
import { isBlobConfigured } from "@/server/storage";
import { requireActiveMembership } from "@/server/auth/session";

export default async function UploadPage() {
  await requireActiveMembership();
  const storageMode = isBlobConfigured() ? "vercel-blob" : "local";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subir pliego</h1>
        <p className="text-muted-foreground">
          Sube el PDF de la licitación pública o el RFP corporativo. Extraeremos el texto automáticamente
          {storageMode === "local" && " (modo de almacenamiento local de desarrollo)"}.
        </p>
      </div>
      <TenderUploadForm storageMode={storageMode} />
    </div>
  );
}
