"use client";

import { useEffect } from "react";
import { AlertTriangle, Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex items-center gap-2 font-semibold tracking-tight">
        <Compass className="h-5 w-5 text-primary" />
        Licitium
      </div>
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <h1 className="text-xl font-semibold tracking-tight">Algo ha ido mal</h1>
      <p className="max-w-sm text-muted-foreground">Ha ocurrido un error inesperado. Puedes intentarlo de nuevo.</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
