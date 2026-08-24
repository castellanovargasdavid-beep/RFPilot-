import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function SettingsPage() {
  return (
    <ComingSoon
      icon={Settings}
      title="Configuración"
      description="Datos de la organización, miembros del equipo y marca blanca (plan Agencia)."
      phase="una fase de pulido posterior"
    />
  );
}
