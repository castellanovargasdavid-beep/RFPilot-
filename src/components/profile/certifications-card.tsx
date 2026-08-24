"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate, daysUntil } from "@/lib/utils";
import type { CompanyProfileView } from "@/server/company-profile/repository";

const EXPIRY_WARNING_DAYS = 60;

export function CertificationsCard({ profile, onChanged }: { profile: CompanyProfileView; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/company-profile/certifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, issuer: issuer || null, expiresAt: expiresAt || null }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("No se pudo añadir la certificación");
      return;
    }
    toast.success("Certificación añadida");
    setOpen(false);
    setName("");
    setIssuer("");
    setExpiresAt("");
    onChanged();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/company-profile/certifications/${id}`, { method: "DELETE" });
    if (res.ok) toast.success("Certificación eliminada");
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Certificaciones</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva certificación</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="certName">Nombre</Label>
                <Input id="certName" value={name} onChange={(e) => setName(e.target.value)} placeholder="ISO 9001" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certIssuer">Entidad emisora (opcional)</Label>
                <Input id="certIssuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certExpires">Fecha de caducidad (opcional)</Label>
                <Input id="certExpires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
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
        {profile.certifications.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin certificaciones registradas.</p>
        )}
        {profile.certifications.map((cert) => {
          const expiringSoon = cert.expiresAt && daysUntil(cert.expiresAt) <= EXPIRY_WARNING_DAYS;
          const expired = cert.expiresAt && daysUntil(cert.expiresAt) < 0;
          return (
            <div key={cert.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{cert.name}</p>
                <p className="text-xs text-muted-foreground">
                  {cert.issuer && `${cert.issuer} · `}
                  {cert.expiresAt ? `Caduca ${formatDate(cert.expiresAt)}` : "Sin fecha de caducidad"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(expiringSoon || expired) && (
                  <Badge variant={expired ? "destructive" : "warning"}>
                    <AlertTriangle className="h-3 w-3" />
                    {expired ? "Caducada" : "Caduca pronto"}
                  </Badge>
                )}
                <Button variant="ghost" size="icon" onClick={() => handleDelete(cert.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
