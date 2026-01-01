"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanMethodCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  recommended?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ScanMethodCard({
  icon: Icon,
  title,
  description,
  recommended = false,
  selected = false,
  onClick,
  className,
}: ScanMethodCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-3 rounded-lg border-2 p-4 text-left transition-all hover:border-gray-400",
        selected
          ? "border-gray-900 bg-gray-50"
          : "border-gray-200 bg-white",
        className
      )}
    >
      {recommended && (
        <span className="absolute -top-2 right-3 rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">
          Recommended
        </span>
      )}

      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          selected ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
    </button>
  );
}
