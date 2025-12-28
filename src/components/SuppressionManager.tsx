"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  AlertCircle,
  Ban,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  FileCode2,
  Filter,
  Hash,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  createAPIClient,
  Suppression,
  SuppressionReason,
  SuppressionStats,
  CreateSuppressionRequest,
  InkogAPIError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// =============================================================================
// Constants
// =============================================================================

const REASON_CONFIG: Record<
  SuppressionReason,
  { label: string; color: string; icon: React.ElementType }
> = {
  false_positive: {
    label: "False Positive",
    color: "text-blue-600 bg-blue-100",
    icon: X,
  },
  accepted_risk: {
    label: "Accepted Risk",
    color: "text-amber-600 bg-amber-100",
    icon: Shield,
  },
  wont_fix: {
    label: "Won't Fix",
    color: "text-red-600 bg-red-100",
    icon: Ban,
  },
  mitigated: {
    label: "Mitigated",
    color: "text-green-600 bg-green-100",
    icon: Check,
  },
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "text-red-600 bg-red-100",
  HIGH: "text-orange-600 bg-orange-100",
  MEDIUM: "text-yellow-600 bg-yellow-100",
  LOW: "text-blue-600 bg-blue-100",
};

// =============================================================================
// Components
// =============================================================================

interface SuppressionBadgeProps {
  reason: SuppressionReason;
}

function SuppressionBadge({ reason }: SuppressionBadgeProps) {
  const config = REASON_CONFIG[reason];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        config.color
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: string | undefined;
}

function SeverityBadge({ severity }: SeverityBadgeProps) {
  if (!severity) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        SEVERITY_COLORS[severity] || "text-gray-600 bg-gray-100"
      )}
    >
      {severity}
    </span>
  );
}

interface StatsCardProps {
  stats: SuppressionStats | null;
  isLoading: boolean;
}

function StatsCards({ stats, isLoading }: StatsCardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-8 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{stats.total_active}</div>
          <div className="text-sm text-muted-foreground">Active</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-amber-600">
            {stats.expiring_soon}
          </div>
          <div className="text-sm text-muted-foreground">Expiring Soon</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-muted-foreground">
            {stats.total_expired}
          </div>
          <div className="text-sm text-muted-foreground">Expired</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-red-600">
            {stats.total_revoked}
          </div>
          <div className="text-sm text-muted-foreground">Revoked</div>
        </CardContent>
      </Card>
    </div>
  );
}

interface CreateSuppressionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: CreateSuppressionRequest) => Promise<void>;
  isLoading: boolean;
}

function CreateSuppressionDialog({
  open,
  onOpenChange,
  onCreate,
  isLoading,
}: CreateSuppressionDialogProps) {
  const [patternId, setPatternId] = useState("");
  const [filePath, setFilePath] = useState("");
  const [lineNumber, setLineNumber] = useState("");
  const [reason, setReason] = useState<SuppressionReason>("false_positive");
  const [justification, setJustification] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateSuppressionRequest = {
      pattern_id: patternId,
      reason,
      justification: justification || undefined,
    };

    if (filePath) data.file_path = filePath;
    if (lineNumber) data.line_number = parseInt(lineNumber, 10);
    if (expiresAt) data.expires_at = new Date(expiresAt).toISOString();

    await onCreate(data);

    // Reset form
    setPatternId("");
    setFilePath("");
    setLineNumber("");
    setReason("false_positive");
    setJustification("");
    setExpiresAt("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Suppression</DialogTitle>
          <DialogDescription>
            Suppress a finding to exclude it from future scans and reports.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pattern_id">Pattern ID *</Label>
            <Input
              id="pattern_id"
              value={patternId}
              onChange={(e) => setPatternId(e.target.value)}
              placeholder="e.g., universal_prompt_injection"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="file_path">File Path</Label>
              <Input
                id="file_path"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="agent/chat.py"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="line_number">Line Number</Label>
              <Input
                id="line_number"
                type="number"
                value={lineNumber}
                onChange={(e) => setLineNumber(e.target.value)}
                placeholder="42"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  id="reason"
                >
                  <SuppressionBadge reason={reason} />
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                {Object.entries(REASON_CONFIG).map(([key, config]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setReason(key as SuppressionReason)}
                  >
                    <SuppressionBadge reason={key as SuppressionReason} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">Justification</Label>
            <textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why this finding is being suppressed..."
              className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires_at">Expires At</Label>
            <Input
              id="expires_at"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for permanent suppression
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !patternId}>
              {isLoading ? "Creating..." : "Create Suppression"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface SuppressionRowProps {
  suppression: Suppression;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}

function SuppressionRow({
  suppression,
  onRevoke,
  isRevoking,
}: SuppressionRowProps) {
  const expiresAt = suppression.expires_at
    ? new Date(suppression.expires_at)
    : null;
  const isExpiringSoon =
    expiresAt && expiresAt.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <div className="font-mono text-sm">{suppression.pattern_id}</div>
          {suppression.pattern_title && (
            <div className="text-xs text-muted-foreground">
              {suppression.pattern_title}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <SeverityBadge severity={suppression.pattern_severity} />
      </TableCell>
      <TableCell>
        {suppression.file_path ? (
          <div className="flex items-center gap-1 text-sm">
            <FileCode2 className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono truncate max-w-[200px]">
              {suppression.file_path}
              {suppression.line_number && `:${suppression.line_number}`}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">All files</span>
        )}
      </TableCell>
      <TableCell>
        <SuppressionBadge reason={suppression.reason} />
      </TableCell>
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-sm">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[120px]">
                  {suppression.created_by.email.split("@")[0]}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{suppression.created_by.email}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell>
        {expiresAt ? (
          <div
            className={cn(
              "flex items-center gap-1 text-sm",
              isExpiringSoon && "text-amber-600"
            )}
          >
            <Clock className="h-3 w-3" />
            <span>{expiresAt.toLocaleDateString()}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Never</span>
        )}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => onRevoke(suppression.id)}
              disabled={isRevoking}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Revoke
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SuppressionManager() {
  const { getToken } = useAuth();
  const { currentOrg, canManageSettings, isPersonalWorkspace } =
    useOrganization();

  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [stats, setStats] = useState<SuppressionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reasonFilter, setReasonFilter] = useState<SuppressionReason | null>(
    null
  );

  const api = React.useMemo(() => createAPIClient(getToken), [getToken]);

  const fetchData = useCallback(async () => {
    if (isPersonalWorkspace || !currentOrg) {
      setSuppressions([]);
      setStats(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [suppressionsRes, statsRes] = await Promise.all([
        api.suppressions.list(currentOrg.id, {
          reason: reasonFilter || undefined,
        }),
        api.suppressions.stats(currentOrg.id),
      ]);

      setSuppressions(suppressionsRes.suppressions);
      setStats(statsRes.stats);
    } catch (err) {
      if (err instanceof InkogAPIError) {
        setError(err.message);
      } else {
        setError("Failed to load suppressions");
      }
    } finally {
      setIsLoading(false);
    }
  }, [api, currentOrg, isPersonalWorkspace, reasonFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = useCallback(
    async (data: CreateSuppressionRequest) => {
      if (!currentOrg) return;

      setIsCreating(true);
      try {
        await api.suppressions.create(currentOrg.id, data);
        setCreateDialogOpen(false);
        await fetchData();
      } catch (err) {
        if (err instanceof InkogAPIError) {
          setError(err.message);
        } else {
          setError("Failed to create suppression");
        }
      } finally {
        setIsCreating(false);
      }
    },
    [api, currentOrg, fetchData]
  );

  const handleRevoke = useCallback(
    async (suppressionId: string) => {
      if (!currentOrg) return;

      setIsRevoking(true);
      try {
        await api.suppressions.revoke(currentOrg.id, suppressionId);
        await fetchData();
      } catch (err) {
        if (err instanceof InkogAPIError) {
          setError(err.message);
        } else {
          setError("Failed to revoke suppression");
        }
      } finally {
        setIsRevoking(false);
      }
    },
    [api, currentOrg, fetchData]
  );

  // Filter suppressions by search query
  const filteredSuppressions = suppressions.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.pattern_id.toLowerCase().includes(query) ||
      s.file_path?.toLowerCase().includes(query) ||
      s.justification?.toLowerCase().includes(query)
    );
  });

  if (isPersonalWorkspace) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No Organization Selected</h3>
          <p className="text-muted-foreground">
            Suppressions are scoped to organizations. Select an organization
            from the sidebar to manage suppressions.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canManageSettings) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You need Admin or Owner role to manage suppressions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Suppressions</h2>
          <p className="text-muted-foreground">
            Manage finding exceptions and baselines for {currentOrg?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Suppression
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <StatsCards stats={stats} isLoading={isLoading} />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patterns, files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              {reasonFilter ? REASON_CONFIG[reasonFilter].label : "All Reasons"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setReasonFilter(null)}>
              All Reasons
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {Object.entries(REASON_CONFIG).map(([key]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setReasonFilter(key as SuppressionReason)}
              >
                <SuppressionBadge reason={key as SuppressionReason} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pattern</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <RefreshCw className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredSuppressions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  No suppressions found
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppressions.map((suppression) => (
                <SuppressionRow
                  key={suppression.id}
                  suppression={suppression}
                  onRevoke={handleRevoke}
                  isRevoking={isRevoking}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <CreateSuppressionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
        isLoading={isCreating}
      />
    </div>
  );
}
