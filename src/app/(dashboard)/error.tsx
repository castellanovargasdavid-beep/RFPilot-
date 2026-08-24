"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="border-destructive/50">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <CardTitle className="text-base">Algo ha ido mal</CardTitle>
        <CardDescription className="max-w-sm">
          Ha ocurrido un error inesperado al cargar esta página. Puedes intentarlo de nuevo.
        </CardDescription>
        <Button onClick={reset}>Reintentar</Button>
      </CardContent>
    </Card>
  );
}
