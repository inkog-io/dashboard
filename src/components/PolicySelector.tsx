"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Check, Shield, Bug, Eye, Scale, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScanPolicy = "low-noise" | "balanced" | "comprehensive" | "governance" | "eu-ai-act";

interface PolicyOption {
  id: ScanPolicy;
  name: string;
  description: string;
  icon: React.ReactNode;
  tiers: string;
}

const POLICY_OPTIONS: PolicyOption[] = [
  {
    id: "low-noise",
    name: "Low Noise",
    description: "Only proven vulnerabilities with taint flow",
    icon: <Zap className="w-4 h-4" />,
    tiers: "Tier 1 only",
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Vulnerabilities and structural risk patterns",
    icon: <Eye className="w-4 h-4" />,
    tiers: "Tier 1 + 2",
  },
  {
    id: "comprehensive",
    name: "Comprehensive",
    description: "All findings including hardening recommendations",
    icon: <Bug className="w-4 h-4" />,
    tiers: "All tiers",
  },
  {
    id: "governance",
    name: "Governance",
    description: "Focus on human oversight and authorization controls",
    icon: <Shield className="w-4 h-4" />,
    tiers: "Article 14",
  },
  {
    id: "eu-ai-act",
    name: "EU AI Act",
    description: "EU AI Act Articles 12, 14, 15 compliance",
    icon: <Scale className="w-4 h-4" />,
    tiers: "Compliance",
  },
];

const STORAGE_KEY = "inkog-scan-policy";

interface PolicySelectorProps {
  value?: ScanPolicy;
  onChange?: (policy: ScanPolicy) => void;
  className?: string;
}

export function PolicySelector({ value, onChange, className }: PolicySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<ScanPolicy>("balanced");

  // Load from localStorage on mount
  useEffect(() => {
    if (value !== undefined) {
      setSelectedPolicy(value);
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && POLICY_OPTIONS.some((p) => p.id === stored)) {
      setSelectedPolicy(stored as ScanPolicy);
    }
  }, [value]);

  const handleSelect = (policy: ScanPolicy) => {
    setSelectedPolicy(policy);
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, policy);
    onChange?.(policy);
  };

  const selected = POLICY_OPTIONS.find((p) => p.id === selectedPolicy) || POLICY_OPTIONS[1];

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">{selected.icon}</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{selected.name}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">({selected.tiers})</span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute z-20 top-full left-0 right-0 mt-1 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            {POLICY_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left",
                  selectedPolicy === option.id && "bg-indigo-50 dark:bg-indigo-950"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 text-gray-400 dark:text-gray-500",
                    selectedPolicy === option.id && "text-indigo-600 dark:text-indigo-400"
                  )}
                >
                  {option.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-medium text-gray-900 dark:text-gray-100",
                        selectedPolicy === option.id && "text-indigo-600 dark:text-indigo-400"
                      )}
                    >
                      {option.name}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {option.tiers}
                    </span>
                    {selectedPolicy === option.id && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {option.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Get the currently selected policy from localStorage
 */
export function getStoredPolicy(): ScanPolicy {
  if (typeof window === "undefined") return "balanced";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && POLICY_OPTIONS.some((p) => p.id === stored)) {
    return stored as ScanPolicy;
  }
  return "balanced";
}
