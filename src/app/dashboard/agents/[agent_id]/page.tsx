"use client";

/**
 * Per-agent / per-scan capability detail.
 *
 * Phase D placeholder: pretty-prints the full Surface returned by
 * GET /v1/capabilities/{scan_id} in three collapsible groups
 * (capabilities, gaps, controls). The interactive graph view lands here
 * in a follow-up.
 */

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  AlertTriangle,
  ShieldCheck,
  Network,
  Wrench,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";

import {
  createAPIClient,
  type CapabilitySurface,
  type CapabilityRow,
  type CapabilityGap,
  type CapabilityControl,
} from "@/lib/api";
import { cn, compactTimeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function AgentCapabilityDetailPage() {
  const params = useParams<{ agent_id: string }>();
  const scanId = params?.agent_id;
  const { getToken } = useAuth();
  const [surface, setSurface] = useState<CapabilitySurface | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scanId) return;
    const api = createAPIClient(() => getToken());
    let cancel = false;
    setLoading(true);
    api.capabilities
      .get(scanId)
      .then((s) => {
        if (!cancel) setSurface(s);
      })
      .catch((e: Error) => {
        if (!cancel) setError(e.message);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [scanId, getToken]);

  const grouped = useMemo(() => groupSurface(surface), [surface]);

  if (!scanId) {
    return <div className="text-muted-foreground">No scan id provided.</div>;
  }
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-2/3 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }
  if (error || !surface) {
    return (
      <div className="border border-destructive/30 bg-destructive/5 rounded p-4 text-destructive">
        <p className="font-medium">Could not load capability surface</p>
        <p className="text-sm">{error || "Unknown error"}</p>
        <Link
          href="/dashboard/agents"
          className="text-sm underline mt-3 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to inventory
        </Link>
      </div>
    );
  }

  const sc = surface.scan;
  const govColor =
    sc.governance_score >= 85
      ? "text-emerald-700 dark:text-emerald-300"
      : sc.governance_score >= 50
      ? "text-amber-700 dark:text-amber-300"
      : "text-rose-700 dark:text-rose-300";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/dashboard/agents">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Agent Inventory
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            Capability Surface
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sc.repo_url} <span className="text-xs">@ {sc.branch}</span>
            {sc.is_head && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                HEAD
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Scanned {compactTimeAgo(new Date(sc.created_at))} · {sc.scan_kind} ·{" "}
            {sc.inkog_version || "—"}
          </p>
        </div>
        <div className="text-right">
          <div className={cn("text-4xl font-bold tabular-nums", govColor)}>
            {sc.governance_score}
            <span className="text-xl text-muted-foreground">/100</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Governance Score
          </div>
        </div>
      </div>

      {/* Counter grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Counter label="Agents" value={sc.agent_count} icon={<Network className="h-4 w-4" />} />
        <Counter label="Tools" value={sc.tool_count} icon={<Wrench className="h-4 w-4" />} />
        <Counter label="MCP Servers" value={sc.mcp_server_count ?? 0} />
        <Counter
          label="Critical"
          value={sc.gap_count_critical}
          tone={sc.gap_count_critical > 0 ? "critical" : "ok"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <Counter
          label="High"
          value={sc.gap_count_high}
          tone={sc.gap_count_high > 0 ? "high" : "ok"}
        />
        <Counter label="Controls Wired" value={sc.enforced_control_count ?? 0} icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <Section title={`Gaps (${grouped.gaps.length})`} icon={<ShieldAlert className="h-5 w-5 text-rose-600" />}>
        {grouped.gaps.length === 0 ? (
          <EmptyMsg msg="No gaps detected — every required control is wired." />
        ) : (
          <ul className="divide-y border rounded-md">
            {grouped.gaps.map((g) => (
              <li key={g.id} className="p-3 flex items-start gap-3">
                <SeverityChip severity={g.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{g.message}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {g.eu_ai_act_articles?.map((a) => (
                      <Pill key={a} text={a} />
                    ))}
                    {g.owasp_ids?.map((a) => (
                      <Pill key={a} text={a} kind="owasp" />
                    ))}
                  </div>
                </div>
                {g.missing_control_type && (
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                    needs {g.missing_control_type}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={`Capabilities (${surface.capabilities.length})`}
        icon={<Wrench className="h-5 w-5 text-primary" />}
      >
        {grouped.byType.map((bucket) => (
          <details key={bucket.type} className="border rounded-md mb-2" open={bucket.type === "invokes_tool"}>
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-muted/50">
              {bucket.type} ({bucket.items.length})
            </summary>
            <ul className="px-3 py-2 space-y-1">
              {bucket.items.slice(0, 50).map((c) => (
                <li key={c.id} className="flex items-center gap-3 text-sm">
                  <span className="text-foreground font-medium">{c.label}</span>
                  {c.effect_category !== "none" && (
                    <EffectChip effect={c.effect_category} />
                  )}
                  {c.is_dangerous && (
                    <span className="text-xs text-rose-600">dangerous</span>
                  )}
                  {c.framework && (
                    <span className="text-xs text-muted-foreground">[{c.framework}]</span>
                  )}
                </li>
              ))}
              {bucket.items.length > 50 && (
                <li className="text-xs text-muted-foreground italic">
                  …and {bucket.items.length - 50} more
                </li>
              )}
            </ul>
          </details>
        ))}
      </Section>

      <Section
        title={`Controls (${surface.controls.length})`}
        icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}
      >
        {surface.controls.length === 0 ? (
          <EmptyMsg msg="No controls wired in this scan." />
        ) : (
          <ul className="space-y-1">
            {surface.controls.map((c: CapabilityControl) => (
              <li key={c.id} className="text-sm flex items-center gap-3">
                <span className="text-foreground font-medium">{c.control_type}</span>
                {c.control_subtype && <span className="text-muted-foreground">({c.control_subtype})</span>}
                {c.blocks_execution && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">blocks</span>
                )}
                {c.required_for && c.required_for.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    for {c.required_for.join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="text-xs text-muted-foreground border-t pt-4">
        Raw scan: <code className="bg-muted px-1.5 py-0.5 rounded">{sc.id}</code> ·{" "}
        Fingerprint:{" "}
        <code className="bg-muted px-1.5 py-0.5 rounded">
          {sc.capability_fingerprint?.slice(0, 16) || "—"}
        </code>{" "}
        <a
          className="ml-3 underline inline-flex items-center gap-1"
          href={`https://api.inkog.io/v1/capabilities/${sc.id}`}
          target="_blank"
          rel="noreferrer"
        >
          Open JSON <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================

function Counter({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "default" | "ok" | "critical" | "high";
}) {
  const toneCls =
    tone === "critical"
      ? "border-rose-500/30 bg-rose-50 dark:bg-rose-900/10"
      : tone === "high"
      ? "border-orange-500/30 bg-orange-50 dark:bg-orange-900/10"
      : tone === "ok"
      ? "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/10"
      : "border-border bg-background";
  return (
    <div className={cn("rounded-lg border p-3", toneCls)}>
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return (
    <div className="border-2 border-dashed rounded-md p-6 text-sm text-muted-foreground text-center">
      {msg}
    </div>
  );
}

function SeverityChip({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    low: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  };
  return (
    <span className={cn("inline-flex items-center text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded", map[severity] ?? "bg-muted text-muted-foreground")}>
      {severity}
    </span>
  );
}

function EffectChip({ effect }: { effect: string }) {
  const map: Record<string, string> = {
    financial: "bg-emerald-100 text-emerald-700",
    destructive: "bg-rose-100 text-rose-700",
    communication: "bg-sky-100 text-sky-700",
    data_mutation: "bg-violet-100 text-violet-700",
  };
  return (
    <span className={cn("text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded", map[effect] ?? "bg-muted text-muted-foreground")}>
      {effect}
    </span>
  );
}

function Pill({ text, kind }: { text: string; kind?: "owasp" }) {
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded font-medium",
        kind === "owasp"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
      )}
    >
      {text}
    </span>
  );
}

function groupSurface(surface: CapabilitySurface | null): {
  gaps: CapabilityGap[];
  byType: { type: string; items: CapabilityRow[] }[];
} {
  if (!surface) return { gaps: [], byType: [] };
  const groups = new Map<string, CapabilityRow[]>();
  for (const c of surface.capabilities ?? []) {
    if (!groups.has(c.capability_type)) groups.set(c.capability_type, []);
    groups.get(c.capability_type)!.push(c);
  }
  const byType = Array.from(groups.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([type, items]) => ({ type, items }));
  return { gaps: surface.gaps ?? [], byType };
}
