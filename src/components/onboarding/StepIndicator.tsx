"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  id: string;
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol className="flex items-center justify-center space-x-2 md:space-x-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isPending = index > currentStep;

          return (
            <li key={step.id} className="flex items-center">
              {/* Step circle */}
              <div className="flex items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    isCompleted && "bg-foreground text-background",
                    isCurrent && "bg-foreground text-background ring-2 ring-foreground ring-offset-2",
                    isPending && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Step label - hidden on mobile */}
                <span
                  className={cn(
                    "ml-2 hidden text-sm font-medium md:block",
                    isCompleted && "text-foreground",
                    isCurrent && "text-foreground",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "ml-2 h-0.5 w-8 md:ml-4 md:w-16",
                    index < currentStep ? "bg-foreground" : "bg-muted"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
