"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyProfileView } from "@/server/company-profile/repository";

export function BasicInfoCard({ profile, onSaved }: { profile: CompanyProfileView; onSaved: () => void }) {
  const [name, setName] = useState(profile.name);
  const [taxId, setTaxId] = useState(profile.taxId ?? "");
  const [legalForm, setLegalForm] = useState(profile.legalForm ?? "");
  const [foundedYear, setFoundedYear] = useState(profile.foundedYear?.toString() ?? "");
  const [employeeCount, setEmployeeCount] = useState(profile.employeeCount?.toString() ?? "");
  const [description, setDescription] = useState(profile.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/company-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        taxId: taxId || null,
        legalForm: legalForm || null,
        foundedYear: foundedYear ? Number(foundedYear) : null,
        employeeCount: employeeCount ? Number(employeeCount) : null,
        description: description || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Datos generales guardados");
      onSaved();
    } else {
      toast.error("No se pudieron guardar los cambios");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Datos generales</CardTitle>
        <CardDescription>CIF/NIF y facturación se cifran en reposo.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="companyName">Nombre de la empresa</Label>
            <Input id="companyName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">CIF/NIF</Label>
            <Input id="taxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalForm">Forma jurídica</Label>
            <Input id="legalForm" value={legalForm} onChange={(e) => setLegalForm(e.target.value)} placeholder="S.L., S.A., autónomo…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="foundedYear">Año de constitución</Label>
            <Input id="foundedYear" type="number" value={foundedYear} onChange={(e) => setFoundedYear(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employeeCount">Nº empleados</Label>
            <Input id="employeeCount" type="number" value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Descripción de la actividad</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
