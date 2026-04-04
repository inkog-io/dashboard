"use client";

import { useState } from "react";
import { Shield, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BadgeGeneratorProps {
  agentId: string;
  agentName: string;
  criticalCount?: number;
  className?: string;
}

type BadgeType = "criticals" | "secured";

const BASE_URL = "https://app.inkog.io";

export function BadgeGenerator({
  agentId,
  agentName,
  criticalCount = 0,
  className,
}: BadgeGeneratorProps) {
  const [badgeType, setBadgeType] = useState<BadgeType>("criticals");
  const [copied, setCopied] = useState(false);

  const badgeUrl = `${BASE_URL}/api/badge/${agentId}?type=${badgeType}`;
  const safeName = (agentName || "agent")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const markdown = `[![Inkog Security](${badgeUrl})](${BASE_URL}/dashboard/results/${agentId})`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("bg-card border border-border rounded-xl p-5", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Security Badges</h3>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Embed a security badge in your GitHub README to show your agent is scanned by Inkog.
      </p>

      {/* Badge type toggle */}
      <div className="flex gap-1 mb-4">
        {(
          [
            { id: "criticals", label: "Critical Count" },
            { id: "secured", label: "Generic" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setBadgeType(t.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              badgeType === t.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Badge preview */}
      <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-center justify-center mb-4">
        {badgeType === "criticals" ? (
          <span className="inline-flex overflow-hidden rounded text-xs font-medium">
            <span className="bg-[#555] text-white px-2 py-0.5">Inkog</span>
            <span
              className={cn(
                "text-white px-2 py-0.5",
                criticalCount === 0 ? "bg-green-600" : "bg-red-600"
              )}
            >
              {criticalCount === 0
                ? "0 Criticals"
                : `${criticalCount} Critical${criticalCount > 1 ? "s" : ""}`}
            </span>
          </span>
        ) : (
          <span className="inline-flex overflow-hidden rounded text-xs font-medium">
            <span className="bg-[#555] text-white px-2 py-0.5">Inkog</span>
            <span className="bg-green-600 text-white px-2 py-0.5">Secured</span>
          </span>
        )}
      </div>

      {/* Markdown snippet */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 font-mono text-[11px] text-muted-foreground truncate">
          {markdown}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-2 bg-foreground text-background text-xs font-medium rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
