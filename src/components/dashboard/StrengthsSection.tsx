"use client";

import {
  CheckCircle,
  Shield,
  Eye,
  FileText,
  Clock,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Strength } from "@/lib/api";

interface StrengthsSectionProps {
  strengths: Strength[];
  className?: string;
}

const controlIcons: Record<string, typeof Shield> = {
  oversight: Eye,
  authorization: Shield,
  audit: FileText,
  rate_limit: Clock,
};

const controlColors: Record<string, { bg: string; text: string; icon: string }> = {
  oversight: {
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-800 dark:text-green-200",
    icon: "text-green-600 dark:text-green-400",
  },
  authorization: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-800 dark:text-blue-200",
    icon: "text-blue-600 dark:text-blue-400",
  },
  audit: {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    text: "text-purple-800 dark:text-purple-200",
    icon: "text-purple-600 dark:text-purple-400",
  },
  rate_limit: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-800 dark:text-amber-200",
    icon: "text-amber-600 dark:text-amber-400",
  },
};

export function StrengthsSection({ strengths, className }: StrengthsSectionProps) {
  if (!strengths || strengths.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 p-4",
        className
      )}
    >
      <h3 className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2 mb-4">
        <CheckCircle className="h-5 w-5" />
        Security Strengths ({strengths.length})
      </h3>

      <div className="space-y-3">
        {strengths.map((strength) => {
          const colors = controlColors[strength.control_type] || controlColors.oversight;
          const Icon = controlIcons[strength.control_type] || Shield;

          return (
            <div
              key={strength.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg",
                colors.bg
              )}
            >
              <div className={cn("flex-shrink-0 mt-0.5", colors.icon)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn("font-medium text-sm", colors.text)}>
                    {strength.title}
                  </p>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300">
                    <Check className="h-3 w-3" />
                    Implemented
                  </span>
                </div>
                <p className={cn("text-sm mt-1 opacity-80", colors.text)}>
                  {strength.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-green-200 dark:border-green-800">
        <p className="text-xs text-green-700 dark:text-green-300">
          These security controls are implemented in your agent, contributing to a higher governance score.
        </p>
      </div>
    </div>
  );
}

/**
 * Compact version for inline display (e.g., in scan summary)
 */
export function StrengthsBadges({ strengths }: { strengths: Strength[] }) {
  if (!strengths || strengths.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {strengths.map((strength) => {
        const Icon = controlIcons[strength.control_type] || Shield;

        return (
          <span
            key={strength.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300"
            title={strength.message}
          >
            <Icon className="h-3 w-3" />
            {strength.title}
          </span>
        );
      })}
    </div>
  );
}
