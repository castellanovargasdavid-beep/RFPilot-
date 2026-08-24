import { Building2 } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ProfilePage() {
  return (
    <ComingSoon
      icon={Building2}
      title="Perfil de empresa"
      description="Certificaciones, facturación, experiencia previa y equipo técnico — reutilizable en todos tus análisis."
      phase="la Fase 4"
    />
  );
}
