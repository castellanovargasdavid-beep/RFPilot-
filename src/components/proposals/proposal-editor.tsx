"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Download,
  FileEdit,
  Loader2,
  RotateCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProposalDraftDetail } from "@/server/proposals/detail-select";
import { flattenSectionTree, type FlatSectionNode } from "@/server/proposals/section-tree";

const POLL_INTERVAL_MS = 2500;

function findNode(nodes: FlatSectionNode[], id: string): FlatSectionNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

function collectBreadcrumb(nodes: FlatSectionNode[], id: string, trail: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.id === id) return trail;
    const found = collectBreadcrumb(node.children, id, [...trail, node.title]);
    if (found) return found;
  }
  return null;
}

function hasAnyGenerating(nodes: FlatSectionNode[]): boolean {
  return nodes.some((n) => n.status === "GENERATING" || hasAnyGenerating(n.children));
}

const SECTION_STATUS_ICON: Record<string, { icon: typeof Circle; className: string }> = {
  EMPTY: { icon: Circle, className: "text-muted-foreground" },
  GENERATING: { icon: Loader2, className: "text-primary animate-spin" },
  GENERATED: { icon: CheckCircle2, className: "text-success" },
  EDITED: { icon: FileEdit, className: "text-primary" },
  FAILED: { icon: XCircle, className: "text-destructive" },
};

export function ProposalEditor({ initial, tenderId }: { initial: ProposalDraftDetail; tenderId: string }) {
  const [draft, setDraft] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contentDraft, setContentDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState<"DOCX" | "PDF" | null>(null);

  const tree = flattenSectionTree(draft);

  useEffect(() => {
    if (!selectedId && tree.length > 0) {
      setSelectedId(tree[0].id);
    }
  }, [tree, selectedId]);

  useEffect(() => {
    const node = selectedId ? findNode(tree, selectedId) : null;
    setContentDraft(node?.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, draft]);

  useEffect(() => {
    if (draft.status !== "GENERATING" && !hasAnyGenerating(tree)) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/proposals/${draft.id}`);
      if (res.ok) setDraft(await res.json());
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [draft, tree]);

  const selectedNode = selectedId ? findNode(tree, selectedId) : null;
  const breadcrumb = selectedId ? (collectBreadcrumb(tree, selectedId) ?? []) : [];

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    const patchRes = await fetch(`/api/proposal-sections/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: contentDraft }),
    });
    const res = await fetch(`/api/proposals/${draft.id}`);
    if (res.ok) setDraft(await res.json());
    setSaving(false);
    if (patchRes.ok) {
      toast.success("Sección guardada");
    } else {
      toast.error("No se pudo guardar la sección");
    }
  }

  async function handleRegenerate() {
    if (!selectedId) return;
    setRegenerating(true);
    const genRes = await fetch(`/api/proposal-sections/${selectedId}/generate`, { method: "POST" });
    if (genRes.ok) {
      toast.info("Regenerando sección con IA…");
    } else {
      toast.error("No se pudo iniciar la regeneración");
    }
    const res = await fetch(`/api/proposals/${draft.id}`);
    if (res.ok) setDraft(await res.json());
    setRegenerating(false);
  }

  async function handleExport(format: "DOCX" | "PDF") {
    setExporting(format);
    const res = await fetch(`/api/proposals/${draft.id}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${draft.title}.${format === "DOCX" ? "docx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exportado a ${format === "DOCX" ? "Word" : "PDF"}`);
    } else {
      toast.error("No se pudo generar la exportación");
    }
    setExporting(null);
  }

  if (draft.status === "GENERATING" && tree.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <FileEdit className="h-8 w-8 animate-pulse text-primary" />
          <p className="font-medium">Generando el índice de la propuesta…</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Claude está analizando la estructura exigida por el pliego. Puede tardar un minuto.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (draft.status === "FAILED") {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <XCircle className="h-8 w-8 text-destructive" />
          <p className="font-medium">No se pudo generar el índice de la propuesta</p>
          <p className="max-w-sm text-sm text-muted-foreground">{draft.errorMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/tenders/${tenderId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{draft.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport("DOCX")} disabled={exporting !== null}>
            {exporting === "DOCX" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar Word
          </Button>
          <Button variant="outline" onClick={() => handleExport("PDF")} disabled={exporting !== null}>
            {exporting === "PDF" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardContent className="p-2">
            <nav className="space-y-0.5">
              {tree.map((node) => (
                <SectionTreeItem key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={setSelectedId} />
              ))}
            </nav>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            {selectedNode ? (
              <>
                <div>
                  {breadcrumb.length > 0 && (
                    <p className="text-xs text-muted-foreground">{breadcrumb.join(" > ")}</p>
                  )}
                  <h2 className="text-lg font-semibold">{selectedNode.title}</h2>
                </div>
                <Textarea
                  value={contentDraft}
                  onChange={(e) => setContentDraft(e.target.value)}
                  rows={16}
                  placeholder="Esta sección aún no tiene contenido — pulsa «Regenerar con IA» para generarlo."
                  className="font-mono text-sm"
                />
                {selectedNode.status === "FAILED" && (
                  <p className="text-sm text-destructive">No se pudo generar esta sección. Inténtalo de nuevo.</p>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Guardar
                  </Button>
                  <Button variant="outline" onClick={handleRegenerate} disabled={regenerating}>
                    {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                    Regenerar con IA
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Selecciona una sección para editarla.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectionTreeItem({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: FlatSectionNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const config = SECTION_STATUS_ICON[node.status] ?? SECTION_STATUS_ICON.EMPTY;
  const Icon = config.icon;

  return (
    <>
      <button
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        className={cn(
          "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors hover:bg-accent",
          selectedId === node.id && "bg-accent font-medium"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", config.className)} />
        <span className="truncate">{node.title}</span>
      </button>
      {node.children.map((child) => (
        <SectionTreeItem key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}
