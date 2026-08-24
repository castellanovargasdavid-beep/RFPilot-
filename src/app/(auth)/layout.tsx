import Link from "next/link";
import { Compass } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold tracking-tight">
          <Compass className="h-5 w-5 text-primary" />
          RFPilot
        </Link>
        {children}
      </div>
    </div>
  );
}
