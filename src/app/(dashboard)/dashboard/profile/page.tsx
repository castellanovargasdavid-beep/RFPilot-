import { requireActiveMembership } from "@/server/auth/session";
import { getOrCreateDefaultProfile, getProfileView } from "@/server/company-profile/repository";
import { CompanyProfileForm } from "@/components/profile/company-profile-form";

export default async function ProfilePage() {
  const membership = await requireActiveMembership();
  const profile = await getOrCreateDefaultProfile(membership.organizationId);
  const view = await getProfileView(profile.id, membership.organizationId);

  if (!view) {
    throw new Error("No se pudo cargar el perfil de empresa.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil de empresa</h1>
        <p className="text-muted-foreground">
          Se reutiliza en todos tus análisis para calcular el semáforo de elegibilidad.
        </p>
      </div>
      <CompanyProfileForm initial={view} />
    </div>
  );
}
