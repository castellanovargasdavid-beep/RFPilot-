import { Bell } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function AlertsPage() {
  return (
    <ComingSoon
      icon={Bell}
      title="Alertas de boletines oficiales"
      description="Recibe un aviso cuando se publique una nueva licitación que coincida con tus palabras clave."
      phase="una fase avanzada, tras el lanzamiento"
    />
  );
}
