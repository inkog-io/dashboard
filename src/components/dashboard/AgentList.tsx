"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Bot,
  Eye,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Pencil,
  Key,
  Terminal,
  Upload,
} from "lucide-react";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/api";

interface AgentListProps {
  agents: Agent[];
  loading?: boolean;
  onAgentClick?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => Promise<void>;
  onRename?: (agent: Agent, newName: string) => Promise<void>;
}

const healthConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  healthy: {
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30",
    label: "Healthy",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
    label: "Warning",
  },
  critical: {
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30",
    label: "Critical",
  },
  unknown: {
    icon: HelpCircle,
    color: "text-muted-foreground bg-muted",
    label: "Unknown",
  },
};

function HealthBadge({ status }: { status: string }) {
  const config = healthConfig[status] || healthConfig.unknown;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        config.color
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function PolicyBadge({ policy }: { policy: string }) {
  const policyLabels: Record<string, { label: string; color: string }> = {
    comprehensive: { label: "Comprehensive", color: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
    balanced: { label: "Balanced", color: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
    "low-noise": { label: "Low Noise", color: "bg-muted text-muted-foreground" },
    governance: { label: "Governance", color: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" },
    "eu-ai-act": { label: "EU AI Act", color: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  };

  const config = policyLabels[policy] || { label: policy, color: "bg-muted text-muted-foreground" };

  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", config.color)}>
      {config.label}
    </span>
  );
}

export function AgentList({
  agents,
  loading = false,
  onAgentClick,
  onDelete,
  onRename,
}: AgentListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleRowClick = (agent: Agent) => {
    if (editingId) return; // Don't navigate while editing
    if (agent.last_scan_id) {
      router.push(`/dashboard/results/${agent.last_scan_id}`);
    }
    onAgentClick?.(agent);
  };

  const handleDelete = async (e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation();

    // If not confirmed yet, show confirmation
    if (confirmDeleteId !== agent.id) {
      setConfirmDeleteId(agent.id);
      return;
    }

    // User confirmed, proceed with deletion
    setDeletingId(agent.id);
    try {
      await onDelete?.(agent);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleEdit = (e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation();
    setEditingId(agent.id);
    setEditName(agent.name);
  };

  const handleSaveName = async (agent: Agent) => {
    if (!editName.trim() || editName === agent.name) {
      setEditingId(null);
      return;
    }

    setSavingId(agent.id);
    try {
      await onRename?.(agent, editName.trim());
    } finally {
      setSavingId(null);
      setEditingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, agent: Agent) => {
    if (e.key === "Enter") {
      handleSaveName(agent);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-8 flex flex-col items-center justify-center text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted-foreground mb-4" />
          <p>Loading agents...</p>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-8 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Bot className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            No agents scanned yet
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Scan your first AI agent to discover security vulnerabilities and behavioral flaws.
          </p>

          {/* Getting Started Steps */}
          <div className="w-full max-w-sm text-left space-y-3 mb-6">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-medium">
                1
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href="/dashboard/api-keys"
                  className="text-sm font-medium text-foreground hover:underline flex items-center gap-1.5"
                >
                  <Key className="h-3.5 w-3.5" />
                  Generate an API key
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Required for CLI and API authentication
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted-foreground/20 text-muted-foreground flex items-center justify-center text-xs font-medium">
                2
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5" />
                  Install the CLI
                </p>
                <code className="text-xs text-muted-foreground mt-0.5 block break-all">
                  go install github.com/inkog-io/inkog/cmd/inkog@latest
                </code>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted-foreground/20 text-muted-foreground flex items-center justify-center text-xs font-medium">
                3
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Scan your agent
                </p>
                <code className="text-xs text-muted-foreground mt-0.5 block">
                  inkog scan ./my-agent
                </code>
              </div>
            </div>
          </div>

          {/* Alternative Option */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>or</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/scan")}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload files directly
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Agent</TableHead>
            <TableHead className="font-semibold">Last Scan</TableHead>
            <TableHead className="font-semibold text-center">Scan #</TableHead>
            <TableHead className="font-semibold text-center">Health</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow
              key={agent.id}
              onClick={() => handleRowClick(agent)}
              className={cn(
                "cursor-pointer transition-colors",
                agent.last_scan_id
                  ? "hover:bg-muted/50"
                  : "opacity-60"
              )}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 rounded-lg bg-muted p-2">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    {editingId === agent.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => handleSaveName(agent)}
                        onKeyDown={(e) => handleKeyDown(e, agent)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 w-48"
                        autoFocus
                        disabled={savingId === agent.id}
                      />
                    ) : (
                      <p className="font-medium text-foreground">
                        {agent.name}
                      </p>
                    )}
                    {agent.path && (
                      <p className="text-xs text-muted-foreground truncate max-w-xs">
                        {agent.path}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>

              <TableCell>
                {agent.last_scan_at ? (
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(agent.last_scan_at), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground/60">Never</span>
                )}
              </TableCell>

              <TableCell className="text-center">
                <span className="text-sm font-mono text-muted-foreground">
                  #{agent.total_scans}
                </span>
              </TableCell>

              <TableCell className="text-center">
                <HealthBadge status={agent.health_status} />
              </TableCell>

              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {agent.last_scan_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/results/${agent.last_scan_id}`);
                      }}
                      className="h-8 px-2"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDelete(e, agent)}
                    disabled={deletingId === agent.id}
                    className={cn(
                      "h-8 px-2",
                      confirmDeleteId === agent.id
                        ? "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {deletingId === agent.id
                      ? "Deleting..."
                      : confirmDeleteId === agent.id
                      ? "Confirm"
                      : "Delete"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleEdit(e, agent)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
