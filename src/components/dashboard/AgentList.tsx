"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Bot,
  Eye,
  RefreshCw,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Pencil,
} from "lucide-react";
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
  onRescan?: (agent: Agent) => void;
  onRename?: (agent: Agent, newName: string) => Promise<void>;
}

const healthConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  healthy: {
    icon: CheckCircle2,
    color: "text-green-600 bg-green-50",
    label: "Healthy",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-600 bg-amber-50",
    label: "Warning",
  },
  critical: {
    icon: AlertCircle,
    color: "text-red-600 bg-red-50",
    label: "Critical",
  },
  unknown: {
    icon: HelpCircle,
    color: "text-gray-500 bg-gray-50",
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
    comprehensive: { label: "Comprehensive", color: "bg-purple-50 text-purple-700" },
    balanced: { label: "Balanced", color: "bg-blue-50 text-blue-700" },
    "low-noise": { label: "Low Noise", color: "bg-gray-50 text-gray-700" },
    governance: { label: "Governance", color: "bg-indigo-50 text-indigo-700" },
    "eu-ai-act": { label: "EU AI Act", color: "bg-green-50 text-green-700" },
  };

  const config = policyLabels[policy] || { label: policy, color: "bg-gray-50 text-gray-600" };

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
  onRescan,
  onRename,
}: AgentListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleRowClick = (agent: Agent) => {
    if (editingId) return; // Don't navigate while editing
    if (agent.last_scan_id) {
      router.push(`/dashboard/results/${agent.last_scan_id}`);
    }
    onAgentClick?.(agent);
  };

  const handleRescan = (e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation();
    router.push(`/dashboard/scan?agent=${encodeURIComponent(agent.name)}&path=${encodeURIComponent(agent.path || "")}`);
    onRescan?.(agent);
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
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="p-8 flex flex-col items-center justify-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mb-4" />
          <p>Loading agents...</p>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-gray-100 dark:bg-gray-700 p-4 mb-4">
            <Bot className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No agents scanned yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
            Start by scanning your first AI agent. Use the CLI or upload files to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => router.push("/dashboard/scan")}>
              Upload Files
            </Button>
            <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <code className="text-xs text-gray-600 dark:text-gray-300">
                inkog scan ./my-agent
              </code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 dark:bg-gray-900/50">
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
                  ? "hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  : "opacity-60"
              )}
            >
              <TableCell className="py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 rounded-lg bg-gray-100 dark:bg-gray-700 p-2">
                    <Bot className="h-5 w-5 text-gray-600 dark:text-gray-300" />
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
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {agent.name}
                      </p>
                    )}
                    {agent.path && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                        {agent.path}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>

              <TableCell className="py-4">
                {agent.last_scan_at ? (
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {formatDistanceToNow(new Date(agent.last_scan_at), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Never</span>
                )}
              </TableCell>

              <TableCell className="py-4 text-center">
                <span className="text-sm font-mono text-gray-600 dark:text-gray-300">
                  #{agent.total_scans}
                </span>
              </TableCell>

              <TableCell className="py-4 text-center">
                <HealthBadge status={agent.health_status} />
              </TableCell>

              <TableCell className="py-4 text-right">
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
                    onClick={(e) => handleRescan(e, agent)}
                    className="h-8 px-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Rescan
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
