"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function RevenueCard({ profile, onChanged }: { profile: CompanyProfileView; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const [amount, setAmount] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/company-profile/revenue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: Number(year), amount: Number(amount) }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("No se pudo guardar la facturación");
      return;
    }
    toast.success("Facturación guardada");
    setOpen(false);
    setAmount("");
    onChanged();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/company-profile/revenue/${id}`, { method: "DELETE" });
    if (res.ok) toast.success("Ejercicio eliminado");
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Facturación</CardTitle>
          <CardDescription>Últimos ejercicios — se usa para el cruce de solvencia económica.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" />
              Añadir ejercicio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Facturación anual</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="revenueYear">Año</Label>
                <Input id="revenueYear" type="number" value={year} onChange={(e) => setYear(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenueAmount">Importe (EUR)</Label>
                <Input id="revenueAmount" type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
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
        {profile.revenueYears.length === 0 && <p className="text-sm text-muted-foreground">Sin datos de facturación.</p>}
        {profile.revenueYears.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
            <p className="text-sm font-medium">{r.year}</p>
            <div className="flex items-center gap-3">
              <p className="text-sm">{formatCurrency(r.amount, r.currency)}</p>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
