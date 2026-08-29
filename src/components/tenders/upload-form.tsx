"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { FileText, Link2, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isAllowedTenderFile } from "@/lib/tender-constraints";

type SourceType = "PUBLIC_TENDER" | "CORPORATE_RFP";

interface RemoteImport {
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
}

export function TenderUploadForm({ storageMode }: { storageMode: "vercel-blob" | "local" }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [remoteImport, setRemoteImport] = useState<RemoteImport | null>(null);
  const [importUrlInput, setImportUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("PUBLIC_TENDER");
  const [contractingBody, setContractingBody] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "creating">("idle");
  const [error, setError] = useState<string | null>(null);

  function pickFile(candidate: File) {
    const validationError = isAllowedTenderFile(candidate);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setRemoteImport(null);
    setFile(candidate);
    if (!title) {
      setTitle(candidate.name.replace(/\.pdf$/i, ""));
    }
  }

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleImportUrl() {
    if (!importUrlInput.trim()) return;
    setImportError(null);
    setImporting(true);
    try {
      const res = await fetch("/api/tenders/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? "No se pudo importar el archivo de esa URL.");
      }
      setFile(null);
      setError(null);
      setRemoteImport({ fileUrl: data.url, fileName: data.fileName, fileSizeBytes: data.fileSizeBytes });
      if (!title) {
        setTitle(String(data.fileName).replace(/\.pdf$/i, ""));
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Error inesperado al importar el archivo.");
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !remoteImport) {
      setError("Selecciona un archivo PDF o impórtalo desde una URL.");
      return;
    }
    setError(null);

    try {
      let fileUrl: string;
      let fileName: string;
      let fileSizeBytes: number;

      if (remoteImport) {
        setPhase("creating");
        ({ fileUrl, fileName, fileSizeBytes } = remoteImport);
      } else {
        setPhase("uploading");
        setProgress(0);
        fileName = file!.name;
        fileSizeBytes = file!.size;

        if (storageMode === "vercel-blob") {
          const blob = await upload(file!.name, file!, {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
            onUploadProgress: ({ percentage }) => setProgress(percentage),
          });
          fileUrl = blob.url;
        } else {
          const formData = new FormData();
          formData.append("file", file!);
          const res = await fetch("/api/tenders/upload-local", { method: "POST", body: formData });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message ?? "No se pudo subir el archivo.");
          }
          const data = await res.json();
          fileUrl = data.url;
          setProgress(100);
        }
        setPhase("creating");
      }

      const createRes = await fetch("/api/tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || fileName,
          fileUrl,
          fileName,
          fileSizeBytes,
          sourceType,
          contractingBody: contractingBody || undefined,
        }),
      });

      if (!createRes.ok) {
        throw new Error("No se pudo registrar la licitación.");
      }

      const { id } = await createRes.json();
      router.push(`/dashboard/tenders/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al subir el archivo.");
      setPhase("idle");
    }
  }

  const isBusy = phase !== "idle";
  const hasSource = !!file || !!remoteImport;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) pickFile(selected);
          }}
        />
        {file ? (
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div className="text-left">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            {!isBusy && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : remoteImport ? (
          <div className="flex items-center gap-3">
            <Link2 className="h-8 w-8 text-primary" />
            <div className="text-left">
              <p className="font-medium">{remoteImport.fileName}</p>
              <p className="text-sm text-muted-foreground">
                {(remoteImport.fileSizeBytes / 1024 / 1024).toFixed(1)} MB · importado desde URL
              </p>
            </div>
            {!isBusy && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setRemoteImport(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Arrastra el PDF del pliego aquí</p>
              <p className="text-sm text-muted-foreground">o haz clic para seleccionarlo — máx. 80MB</p>
            </div>
          </>
        )}
      </div>

      {!hasSource && (
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">o</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {!hasSource && (
        <div className="space-y-2">
          <Label htmlFor="importUrl">Importar desde una URL (p. ej. el enlace directo del PDF en la PLACSP)</Label>
          <div className="flex gap-2">
            <Input
              id="importUrl"
              type="url"
              placeholder="https://contrataciondelestado.es/.../pliego.pdf"
              value={importUrlInput}
              onChange={(e) => setImportUrlInput(e.target.value)}
              disabled={importing}
            />
            <Button type="button" variant="outline" onClick={handleImportUrl} disabled={importing || !importUrlInput.trim()}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Importar
            </Button>
          </div>
          {importError && <p className="text-sm text-destructive">{importError}</p>}
        </div>
      )}

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Título de la licitación</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isBusy} required />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)} disabled={isBusy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC_TENDER">Licitación pública</SelectItem>
                <SelectItem value="CORPORATE_RFP">RFP corporativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractingBody">Organismo/empresa contratante (opcional)</Label>
            <Input
              id="contractingBody"
              value={contractingBody}
              onChange={(e) => setContractingBody(e.target.value)}
              disabled={isBusy}
            />
          </div>
        </CardContent>
      </Card>

      {isBusy && (
        <div className="space-y-2">
          <Progress value={phase === "creating" ? 100 : progress} />
          <p className="text-sm text-muted-foreground">
            {phase === "uploading" ? "Subiendo pliego…" : "Registrando licitación…"}
          </p>
        </div>
      )}

      <Button type="submit" disabled={!hasSource || isBusy}>
        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
        Analizar licitación
      </Button>
    </form>
  );
}
