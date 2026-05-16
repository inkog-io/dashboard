"use client";

/**
 * Agents Inventory page.
 *
 * Server-side data: pulled from GET /v1/capabilities (list of capability scans
 * across the org's repos), then GET /v1/capabilities/{scan_id} for the head
 * scan to flatten into one row per agent-definition.
 *
 * This is the Phase D bootstrap view: a sortable table, no graph. The full
 * topology comes via the per-scan detail page.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Bot,
  Network,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  ShieldCheck,
  Search,
  RefreshCw,
} from "lucide-react";

import {
  createAPIClient,
  type CapabilityScanHeader,
  type CapabilityRow,
  type CapabilitySurface,
  type InkogAPI,
} from "@/lib/api";
import { cn, compactTimeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AgentRowVM = {
  agentId: string;
  scanId: string;
  agentLabel: string;
  framework: string;
  toolCount: number;
  mcpCount: number;
  critical: number;
  high: number;
  governance: number;
  lastScan: string; // ISO
  repo: string;
};

type SortKey =
  | "agentLabel"
  | "framework"
  | "toolCount"
  | "mcpCount"
  | "gaps"
  | "governance"
  | "lastScan";
type SortDir = "asc" | "desc";

export default function AgentsPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [api, setApi] = useState<InkogAPI | null>(null);
  const [headers, setHeaders] = useState<CapabilityScanHeader[]>([]);
  const [rows, setRows] = useState<AgentRowVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("gaps");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Client-side API instance (Clerk token getter)
  useEffect(() => {
    setApi(createAPIClient(() => getToken()));
  }, [getToken]);

  // Load capability scans + flatten per-agent rows
  const reload = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.capabilities.list();
      const scans = list.scans ?? [];
      setHeaders(scans);
      if (scans.length === 0) {
        setRows([]);
        return;
      }
      // Fetch head scans only (one per repo+branch). Cap parallelism at 8
      // so a large org doesn't fan out into hundreds of concurrent fetches.
      const heads = scans.filter((s) => s.is_head).slice(0, 24);
      const surfaces = await Promise.allSettled(
        heads.map((h) => api.capabilities.get(h.id))
      );
      const flatRows: AgentRowVM[] = [];
      for (const result of surfaces) {
        if (result.status !== "fulfilled") continue;
        flatRows.push(...flattenAgents(result.value));
      }
      setRows(flatRows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load agents";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Derived: filtered + sorted view
  const view = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.agentLabel.toLowerCase().includes(q) ||
            r.framework.toLowerCase().includes(q) ||
            r.repo.toLowerCase().includes(q)
        )
      : rows;
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "agentLabel":
          return a.agentLabel.localeCompare(b.agentLabel) * dir;
        case "framework":
          return a.framework.localeCompare(b.framework) * dir;
        case "toolCount":
          return (a.toolCount - b.toolCount) * dir;
        case "mcpCount":
          return (a.mcpCount - b.mcpCount) * dir;
        case "gaps":
          return (
            (a.critical * 10 + a.high - (b.critical * 10 + b.high)) * dir
          );
        case "governance":
          return (a.governance - b.governance) * dir;
        case "lastScan":
          return (
            (new Date(a.lastScan).getTime() - new Date(b.lastScan).getTime()) *
            dir
          );
      }
    });
    return sorted;
  }, [rows, search, sortBy, sortDir]);

  const onSort = useCallback(
    (key: SortKey) => {
      if (sortBy === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(key);
        setSortDir(
          // numeric/severity columns default to descending (worst-first)
          key === "gaps" || key === "toolCount" || key === "mcpCount" ? "desc" : "asc"
        );
      }
    },
    [sortBy]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            Agent Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every agent the scanner has discovered across your scanned repos, with their tools, controls, gaps, and governance score.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/scan">Scan now</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/30 bg-destructive/5 text-destructive rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative w-72">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Filter by agent, framework, repo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {loading
            ? "Loading…"
            : `${view.length} agent${view.length === 1 ? "" : "s"} across ${headers.length} scan${
                headers.length === 1 ? "" : "s"
              }`}
        </span>
      </div>

      {!loading && view.length === 0 ? (
        <EmptyState hasAnyScans={headers.length > 0} />
      ) : (
        <div className="border rounded-lg bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTh label="Agent" k="agentLabel" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <SortableTh label="Framework" k="framework" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <SortableTh label="Tools" k="toolCount" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
                <SortableTh label="MCP" k="mcpCount" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
                <SortableTh label="Gaps" k="gaps" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
                <SortableTh label="Governance" k="governance" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
                <SortableTh label="Last scan" k="lastScan" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : view.map((r) => (
                    <TableRow
                      key={r.agentId + ":" + r.scanId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/dashboard/agents/${r.scanId}`)}
                    >
                      <TableCell className="font-medium text-foreground flex items-center gap-2 min-w-0">
                        <Bot className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{r.agentLabel}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.framework || "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.toolCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.mcpCount}</TableCell>
                      <TableCell className="text-right">
                        <GapsCell critical={r.critical} high={r.high} />
                      </TableCell>
                      <TableCell className="text-right">
                        <GovernanceBadge score={r.governance} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {compactTimeAgo(new Date(r.lastScan))}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================

function SortableTh({
  label,
  k,
  sortBy,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  k: SortKey;
  sortBy: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortBy === k;
  return (
    <TableHead className={cn("cursor-pointer select-none", className)} onClick={() => onSort(k)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
      </span>
    </TableHead>
  );
}

function GovernanceBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : score >= 50
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", color)}>
      {score >= 85 ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {score}%
    </span>
  );
}

function GapsCell({ critical, high }: { critical: number; high: number }) {
  if (critical === 0 && high === 0) {
    return <span className="text-muted-foreground tabular-nums">0</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {critical > 0 && (
        <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
          {critical}C
        </span>
      )}
      {high > 0 && (
        <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
          {high}H
        </span>
      )}
    </span>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-3.5 bg-muted rounded animate-pulse" />
        </TableCell>
      ))}
    </TableRow>
  );
}

function EmptyState({ hasAnyScans }: { hasAnyScans: boolean }) {
  return (
    <div className="border-2 border-dashed rounded-lg p-12 text-center">
      <Network className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <h3 className="text-base font-medium text-foreground">
        {hasAnyScans ? "No agents found in the latest scans" : "No capability scans yet"}
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        Capability data is populated when you scan agent code with{" "}
        <code className="text-xs px-1 py-0.5 rounded bg-muted">inkog -path ./your-code</code>.
        {" "}The surface appears here within seconds.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2">
        <Button asChild size="sm">
          <Link href="/dashboard/scan">Run your first scan</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/onboarding">Install the CLI</Link>
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function flattenAgents(surface: CapabilitySurface): AgentRowVM[] {
  if (!surface?.scan) return [];
  const agents = (surface.capabilities ?? []).filter(
    (c) => c.capability_type === "agent_definition"
  );
  if (agents.length === 0) {
    // Fall back to a single synthetic row for the whole scan so the table
    // isn't empty when the adapter didn't detect a named agent definition.
    return [
      {
        agentId: surface.scan.id,
        scanId: surface.scan.id,
        agentLabel: surface.scan.repo_url || "anonymous",
        framework: "-",
        toolCount: surface.scan.tool_count,
        mcpCount: surface.scan.mcp_server_count ?? 0,
        critical: surface.scan.gap_count_critical,
        high: surface.scan.gap_count_high,
        governance: surface.scan.governance_score,
        lastScan: surface.scan.created_at,
        repo: surface.scan.repo_url,
      },
    ];
  }
  return agents.map((agent) => {
    const tools = countByType(surface.capabilities, "invokes_tool", agent.id);
    const mcp = countByType(surface.capabilities, "reaches_mcp_server", agent.id);
    const { critical, high } = countSeverityForAgent(surface.gaps, agent.id);
    return {
      agentId: agent.id,
      scanId: surface.scan.id,
      agentLabel: agent.label,
      framework: agent.framework ?? "-",
      toolCount: tools,
      mcpCount: mcp,
      critical,
      high,
      // Per-agent governance isn't computed yet, so use the scan-level
      // score as a proxy. Refined when GovernanceScoreCalculator gains
      // per-agent breakdown.
      governance: surface.scan.governance_score,
      lastScan: surface.scan.created_at,
      repo: surface.scan.repo_url,
    };
  });
}

function countByType(caps: CapabilityRow[], type: string, agentId: string): number {
  let n = 0;
  for (const c of caps) {
    if (c.capability_type === type && c.agent_id === agentId) n++;
  }
  return n;
}

function countSeverityForAgent(
  gaps: { agent_id?: string | null; severity: string }[] | undefined,
  agentId: string
): { critical: number; high: number } {
  let critical = 0;
  let high = 0;
  for (const g of gaps ?? []) {
    if (g.agent_id !== agentId) continue;
    if (g.severity === "critical") critical++;
    else if (g.severity === "high") high++;
  }
  return { critical, high };
}
