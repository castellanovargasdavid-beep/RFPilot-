import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Compass className="h-5 w-5 text-primary" />
            RFPilot
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Crear cuenta</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 text-sm text-muted-foreground">
        <div className="container flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p>© {new Date().getFullYear()} RFPilot. Todos los derechos reservados.</p>
          <p>Analiza PCAP y PPT con IA — no descartes una licitación sin leerla.</p>
        </div>
      </footer>
    </div>
  );
}
