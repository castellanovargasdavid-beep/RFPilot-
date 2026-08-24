import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="max-w-md">{description}</CardDescription>
        <p className="text-xs text-muted-foreground">Disponible en {phase}</p>
      </CardContent>
    </Card>
  );
}
