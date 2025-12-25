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
    bg: "bg-white",
    iconBg: "bg-gray-100",
    iconColor: "text-gray-600",
  },
  success: {
    bg: "bg-white",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  warning: {
    bg: "bg-white",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  danger: {
    bg: "bg-white",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
  },
  info: {
    bg: "bg-white",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
};

const badgeStyles: Record<"success" | "warning" | "danger", string> = {
  success: "bg-green-100 text-green-700 border-green-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  danger: "bg-red-100 text-red-700 border-red-200",
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
      "rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm transition-shadow hover:shadow-md",
      styles.bg,
      "dark:bg-gray-800"
    )}>
      <div className="flex items-start justify-between">
        <div className={cn(
          "p-2.5 rounded-lg",
          styles.iconBg,
          "dark:bg-opacity-20"
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
          <div className="h-8 w-20 bg-gray-100 dark:bg-gray-700 animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          {tooltip && (
            <div className="relative group">
              <Info className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-56 z-50 pointer-events-none">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
              </div>
            </div>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
