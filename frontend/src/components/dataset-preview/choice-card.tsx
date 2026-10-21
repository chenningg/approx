import { Loader2Icon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChoiceCardProps {
  icon: LucideIcon;
  title: string;
  hint: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
}

export function ChoiceCard({
  icon: Icon,
  title,
  hint,
  onClick,
  disabled = false,
  busy = false,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 cursor-pointer rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50",
        (disabled || busy) &&
          "cursor-not-allowed opacity-60 hover:border-border hover:bg-transparent",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
        {busy ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <Icon className="size-4" />
        )}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {disabled && <Badge variant="secondary">Coming soon</Badge>}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
    </button>
  );
}
