import Link from "next/link";
import { FileSearch, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TenderStatusBadge, EligibilityBadge } from "@/components/tenders/status-badge";
import { requireActiveMembership } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate, daysUntil } from "@/lib/utils";

export default async function DashboardPage() {
  const membership = await requireActiveMembership();

  const tenders = await prisma.tender.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      analyses: { orderBy: { version: "desc" }, take: 1, select: { eligibilityStatus: true } },
    },
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
              <p className="font-medium">Aún no has analizado ninguna licitación</p>
              <p className="text-sm text-muted-foreground">Sube tu primer pliego en PDF para ver el semáforo de elegibilidad.</p>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Licitación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Semáforo</TableHead>
                <TableHead>Plazo</TableHead>
                <TableHead>Páginas</TableHead>
                <TableHead>Subida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenders.map((tender) => (
                <TableRow key={tender.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/dashboard/tenders/${tender.id}`} className="font-medium hover:underline">
                      {tender.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <TenderStatusBadge status={tender.status} />
                  </TableCell>
                  <TableCell>
                    {tender.analyses[0]?.eligibilityStatus ? (
                      <EligibilityBadge status={tender.analyses[0].eligibilityStatus} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {tender.submissionDeadline ? (
                      <span
                        className={
                          daysUntil(tender.submissionDeadline) <= 5 ? "font-medium text-destructive" : undefined
                        }
                      >
                        {formatDate(tender.submissionDeadline)} ({daysUntil(tender.submissionDeadline)} d)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{tender.pageCount ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(tender.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
