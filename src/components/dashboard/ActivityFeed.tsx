"use client";

import { useMemo } from "react";
import { Shield, Server, Bot } from "lucide-react";
import { cn, compactTimeAgo } from "@/lib/utils";
import type { Scan } from "@/lib/api";

interface ActivityFeedProps {
  scans: Scan[];
  skillScans: Scan[];
  className?: string;
}

interface ActivityEvent {
  id: string;
  type: "scan" | "skill" | "mcp";
  title: string;
  subtitle: string;
  borderColor: string;
  icon: React.ElementType;
  timestamp: string;
}

function getEventFromScan(scan: Scan): ActivityEvent {
  const isMcp = scan.scan_type === "mcp";
  const isSkill = scan.scan_type === "skill";
  const name = scan.agent_name || "Unknown";
  const timeAgo = compactTimeAgo(new Date(scan.created_at));

  if (isMcp) {
    return {
      id: scan.id,
      type: "mcp",
      title: "MCP server scanned",
      subtitle: `${name} · ${timeAgo}`,
      borderColor: "border-amber-500",
      icon: Server,
      timestamp: scan.created_at,
    };
  }

  if (isSkill) {
    return {
      id: scan.id,
      type: "skill",
      title: "Skill package scanned",
      subtitle: `${name} · ${timeAgo}`,
      borderColor: "border-blue-500",
      icon: Shield,
      timestamp: scan.created_at,
    };
  }

  return {
    id: scan.id,
    type: "scan",
    title: scan.critical_count > 0
      ? `${scan.critical_count} critical risk${scan.critical_count > 1 ? "s" : ""} found`
      : "Scan completed",
    subtitle: `${name} · ${timeAgo}`,
    borderColor: scan.critical_count > 0 ? "border-red-500" : "border-green-500",
    icon: Bot,
    timestamp: scan.created_at,
  };
}

export function ActivityFeed({ scans, skillScans, className }: ActivityFeedProps) {
  const events = useMemo(() => {
    const allScans = [...scans, ...skillScans];
    // Deduplicate by ID (skillScans may overlap with scans)
    const seen = new Set<string>();
    const unique = allScans.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    return unique
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8)
      .map(getEventFromScan);
  }, [scans, skillScans]);

  if (events.length === 0) {
    return (
      <div className={cn("bg-card border border-border rounded-xl p-6", className)}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
        <p className="text-sm text-muted-foreground">No activity yet. Run your first scan to see events here.</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border border-border rounded-xl p-5", className)}>
      <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
      <div className="flex flex-col gap-3">
        {events.map((event) => {
          const Icon = event.icon;
          return (
            <div
              key={event.id}
              className={cn("border-l-2 pl-3 py-0.5", event.borderColor)}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-medium text-foreground">{event.title}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 ml-[18px]">{event.subtitle}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
