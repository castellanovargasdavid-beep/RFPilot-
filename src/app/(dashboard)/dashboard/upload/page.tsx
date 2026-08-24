import { Upload } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function UploadPage() {
  return (
    <ComingSoon
      icon={Upload}
      title="Subida y extracción de pliegos"
      description="Arrastra el PDF de la licitación y RFPilot extraerá el texto automáticamente (con fallback OCR para escaneados)."
      phase="la Fase 2"
    />
  );
}
