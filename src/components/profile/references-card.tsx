"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import type { CompanyProfileView } from "@/server/company-profile/repository";

export function ReferencesCard({ profile, onChanged }: { profile: CompanyProfileView; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [sector, setSector] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/company-profile/references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        clientName,
        sector: sector || null,
        amount: amount ? Number(amount) : null,
        description: description || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("No se pudo añadir la referencia");
      return;
    }
    toast.success("Referencia añadida");
    setOpen(false);
    setTitle("");
    setClientName("");
    setSector("");
    setAmount("");
    setDescription("");
    onChanged();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/company-profile/references/${id}`, { method: "DELETE" });
    if (res.ok) toast.success("Referencia eliminada");
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Experiencia y referencias</CardTitle>
          <CardDescription>Contratos/proyectos previos similares.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva referencia</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="refTitle">Título del proyecto/contrato</Label>
                <Input id="refTitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refClient">Cliente</Label>
                <Input id="refClient" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="refSector">Sector (opcional)</Label>
                  <Input id="refSector" value={sector} onChange={(e) => setSector(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refAmount">Importe (opcional)</Label>
                  <Input id="refAmount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refDescription">Descripción (opcional)</Label>
                <Textarea id="refDescription" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {profile.references.length === 0 && <p className="text-sm text-muted-foreground">Sin referencias registradas.</p>}
        {profile.references.map((ref) => (
          <div key={ref.id} className="flex items-start justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{ref.title}</p>
              <p className="text-xs text-muted-foreground">
                {ref.clientName}
                {ref.sector && ` · ${ref.sector}`}
                {ref.amount != null && ` · ${formatCurrency(ref.amount, ref.currency)}`}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(ref.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
