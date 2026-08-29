import Link from "next/link";
import { Compass, FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <Compass className="h-5 w-5 text-primary" />
        Licitium
      </Link>
      <FileQuestion className="h-10 w-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold tracking-tight">Página no encontrada</h1>
      <p className="max-w-sm text-muted-foreground">
        La página que buscas no existe o se ha movido.
      </p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
