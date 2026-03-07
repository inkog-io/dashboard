"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanMethodCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  recommended?: boolean;
  quickest?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ScanMethodCard({
  icon: Icon,
  title,
  description,
  recommended = false,
  quickest = false,
  selected = false,
  onClick,
  className,
}: ScanMethodCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-3 rounded-lg border-2 p-4 text-left transition-all hover:border-muted-foreground",
        selected
          ? "border-foreground bg-surface"
          : "border-border bg-card",
        className
      )}
    >
      {recommended && (
        <span className="absolute -top-2 right-3 rounded-full bg-foreground px-2 py-0.5 text-xs font-medium text-background">
          Recommended
        </span>
      )}
      {quickest && !recommended && (
        <span className="absolute -top-2 right-3 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
          Quickest
        </span>
      )}

      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          selected ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
