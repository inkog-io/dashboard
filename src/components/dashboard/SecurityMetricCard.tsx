"use client";

import { type LucideIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/ui/sparkline";

export type MetricVariant = "default" | "success" | "warning" | "danger" | "info";

interface SecurityMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: MetricVariant;
  loading?: boolean;
  badge?: {
    text: string;
    variant: "success" | "warning" | "danger";
  };
  /** 7-day trend data for sparkline visualization */
  trend?: number[];
  /** Tooltip explaining what this metric means */
  tooltip?: string;
}

const variantStyles: Record<MetricVariant, { bg: string; iconBg: string; iconColor: string }> = {
  default: {
    bg: "bg-card",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
  },
  success: {
    bg: "bg-card",
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
  },
  warning: {
    bg: "bg-card",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    bg: "bg-card",
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
  },
  info: {
    bg: "bg-card",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
};

const badgeStyles: Record<"success" | "warning" | "danger", string> = {
  success: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  danger: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
};

export function SecurityMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  loading = false,
  badge,
  trend,
  tooltip,
}: SecurityMetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn(
      "rounded-xl border border-border p-5 shadow-sm transition-shadow hover:shadow-md",
      styles.bg
    )}>
      <div className="flex items-start justify-between">
        <div className={cn(
          "p-2.5 rounded-lg",
          styles.iconBg
        )}>
          <Icon className={cn("h-5 w-5", styles.iconColor)} />
        </div>

        <div className="flex items-center gap-2">
          {trend && trend.length > 1 && (
            <Sparkline
              data={trend}
              width={48}
              height={20}
              color={variant === "danger" ? "#ef4444" : "#22c55e"}
            />
          )}
          {badge && (
            <span className={cn(
              "px-2 py-0.5 text-xs font-medium rounded-full border",
              badgeStyles[badge.variant]
            )}>
              {badge.text}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="h-8 w-20 bg-muted animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-semibold font-mono text-foreground">{value}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {tooltip && (
            <div className="relative group">
              <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-56 z-50 pointer-events-none">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
              </div>
            </div>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground/80 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
