"use client";

import { type LucideIcon } from "lucide-react";
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
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{title}</p>
        {subtitle && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
