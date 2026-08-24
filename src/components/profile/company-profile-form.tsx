"use client";

import { useRouter } from "next/navigation";

import type { CompanyProfileView } from "@/server/company-profile/repository";
import { BasicInfoCard } from "./basic-info-card";
import { CertificationsCard } from "./certifications-card";
import { RevenueCard } from "./revenue-card";
import { ReferencesCard } from "./references-card";
import { TeamCard } from "./team-card";

export function CompanyProfileForm({ initial }: { initial: CompanyProfileView }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-6">
      <BasicInfoCard profile={initial} onSaved={refresh} />
      <CertificationsCard profile={initial} onChanged={refresh} />
      <RevenueCard profile={initial} onChanged={refresh} />
      <ReferencesCard profile={initial} onChanged={refresh} />
      <TeamCard profile={initial} onChanged={refresh} />
    </div>
  );
}
