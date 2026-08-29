"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LayoutDashboard, Building2, CreditCard, Bell, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Licitaciones", icon: LayoutDashboard },
  { href: "/dashboard/profile", label: "Perfil de empresa", icon: Building2 },
  { href: "/dashboard/alerts", label: "Alertas", icon: Bell },
  { href: "/dashboard/billing", label: "Facturación", icon: CreditCard },
  { href: "/dashboard/settings", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-muted/20 md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 px-6 font-semibold tracking-tight">
        <Compass className="h-5 w-5 text-primary" />
        Licitium
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {links.map((link) => {
          const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
