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
import type { CompanyProfileView } from "@/server/company-profile/repository";

export function TeamCard({ profile, onChanged }: { profile: CompanyProfileView; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/company-profile/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        role,
        yearsExperience: yearsExperience ? Number(yearsExperience) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("No se pudo añadir el miembro del equipo");
      return;
    }
    toast.success("Miembro del equipo añadido");
    setOpen(false);
    setName("");
    setRole("");
    setYearsExperience("");
    onChanged();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/company-profile/team/${id}`, { method: "DELETE" });
    if (res.ok) toast.success("Miembro eliminado");
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Equipo técnico</CardTitle>
          <CardDescription>Perfiles clave y su experiencia.</CardDescription>
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
              <DialogTitle>Nuevo miembro del equipo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="memberName">Nombre</Label>
                <Input id="memberName" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberRole">Rol</Label>
                <Input id="memberRole" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Jefe de proyecto" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberYears">Años de experiencia</Label>
                <Input
                  id="memberYears"
                  type="number"
                  min="0"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                />
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
        {profile.teamMembers.length === 0 && <p className="text-sm text-muted-foreground">Sin miembros de equipo registrados.</p>}
        {profile.teamMembers.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{m.name}</p>
              <p className="text-xs text-muted-foreground">
                {m.role}
                {m.yearsExperience != null && ` · ${m.yearsExperience} años`}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
