import Link from "next/link";
import { FileSearch, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const membership = await requireActiveMembership();

  const tenders = await prisma.tender.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Licitaciones</h1>
          <p className="text-muted-foreground">Analiza un nuevo pliego o retoma uno en curso.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/upload">
            <Upload className="h-4 w-4" />
            Subir pliego
          </Link>
        </Button>
      </div>

      {tenders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileSearch className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base">Aún no has analizado ninguna licitación</CardTitle>
              <CardDescription>Sube tu primer pliego en PDF para ver el semáforo de elegibilidad.</CardDescription>
            </div>
            <Button asChild>
              <Link href="/dashboard/upload">
                <Upload className="h-4 w-4" />
                Subir el primer pliego
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de análisis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tenders.length} licitación{tenders.length === 1 ? "" : "es"} —
              la vista detallada llega en la Fase 2 (subida y extracción de PDF).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
