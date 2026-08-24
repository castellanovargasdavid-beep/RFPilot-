import { requireActiveMembership } from "@/server/auth/session";
import { getCreditBalance } from "@/server/billing/credits";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { auth } from "@/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [membership, session] = await Promise.all([requireActiveMembership(), auth()]);
  const creditBalance = await getCreditBalance(membership.organizationId);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar
          organizationName={membership.organization.name}
          userName={session?.user?.name ?? null}
          userEmail={session?.user?.email ?? ""}
          creditBalance={creditBalance}
        />
        <main className="flex-1 bg-muted/10 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
