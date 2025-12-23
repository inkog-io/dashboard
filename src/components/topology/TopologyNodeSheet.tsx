'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  RefreshCw,
  Bot,
  Wrench,
  MessageSquare,
  User,
  Lock,
  Clock,
  FileText,
  Link2,
  Database,
  Package,
  AlertTriangle,
  ExternalLink,
  Files,
  ChevronRight,
} from 'lucide-react';
import type { Finding, TopologyNode } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { MergedNodeInfo } from './SuperNode';

// Node type icons
const nodeIconMap: Record<string, React.ElementType> = {
  Loop: RefreshCw,
  LLMCall: Bot,
  ToolCall: Wrench,
  SystemPrompt: MessageSquare,
  HumanApproval: User,
  AuthorizationCheck: Lock,
  RateLimitConfig: Clock,
  AuditLog: FileText,
  Delegation: Link2,
  MemoryAccess: Database,
  Default: Package,
};

// Risk level styling
const riskStyles: Record<string, { badge: string; text: string }> = {
  SAFE: { badge: 'bg-green-100 text-green-800', text: 'text-green-600' },
  LOW: { badge: 'bg-blue-100 text-blue-800', text: 'text-blue-600' },
  MEDIUM: { badge: 'bg-amber-100 text-amber-800', text: 'text-amber-600' },
  HIGH: { badge: 'bg-orange-100 text-orange-800', text: 'text-orange-600' },
  CRITICAL: { badge: 'bg-red-100 text-red-800', text: 'text-red-600' },
};

// Severity styling for findings
const severityStyles: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
  LOW: 'bg-blue-100 text-blue-800 border-blue-200',
};

export interface SelectedNodeData {
  id: string;
  label: string;
  type: string;
  riskLevel: string;
  riskReasons?: string[];
  location?: { file?: string; line?: number };
  // For supernodes
  isSuperNode?: boolean;
  mergedCount?: number;
  mergedNodes?: MergedNodeInfo[];
  // For ghost nodes
  isGhost?: boolean;
  missingControl?: string;
}

interface TopologyNodeSheetProps {
  node: SelectedNodeData | null;
  findings: Finding[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFindingClick?: (findingId: string) => void;
}

/**
 * Find findings related to a node by matching file and line proximity.
 */
function findRelatedFindings(node: SelectedNodeData, findings: Finding[]): Finding[] {
  if (!node.location?.file) return [];

  return findings.filter((f) => {
    // Match same file
    if (f.file !== node.location?.file) return false;
    // Match within 15 lines of the node's location
    const nodeLine = node.location?.line || 0;
    return Math.abs(f.line - nodeLine) <= 15;
  });
}

export function TopologyNodeSheet({
  node,
  findings,
  open,
  onOpenChange,
  onFindingClick,
}: TopologyNodeSheetProps) {
  if (!node) return null;

  const Icon = nodeIconMap[node.type] || nodeIconMap.Default;
  const riskStyle = riskStyles[node.riskLevel] || riskStyles.SAFE;
  const relatedFindings = findRelatedFindings(node, findings);

  // For supernodes, show list of merged nodes
  const isSuperNode = node.isSuperNode && node.mergedNodes && node.mergedNodes.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                node.isGhost ? 'bg-red-100' : 'bg-gray-100'
              )}
            >
              {isSuperNode ? (
                <Files className="h-5 w-5 text-gray-700" />
              ) : (
                <Icon
                  className={cn('h-5 w-5', node.isGhost ? 'text-red-600' : 'text-gray-700')}
                />
              )}
            </div>
            <div>
              <SheetTitle className="text-left">{node.label}</SheetTitle>
              <SheetDescription className="text-left">
                {node.type}
                {node.location?.file && (
                  <>
                    {' '}&bull;{' '}
                    <span className="font-mono text-xs">
                      {node.location.file}
                      {node.location.line && `:${node.location.line}`}
                    </span>
                  </>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Risk Level Badge */}
          {!node.isGhost && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">Risk Level</h4>
              <span className={cn('px-3 py-1 rounded-full text-sm font-medium', riskStyle.badge)}>
                {node.riskLevel}
              </span>
            </div>
          )}

          {/* Ghost Node Info */}
          {node.isGhost && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Missing Control</span>
              </div>
              <p className="text-sm text-red-600">
                This control is required for EU AI Act compliance and secure agent operation.
                Add {node.missingControl?.replace('_', ' ')} to your agent workflow.
              </p>
            </div>
          )}

          {/* Risk Reasons */}
          {node.riskReasons && node.riskReasons.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">Risk Factors</h4>
              <ul className="space-y-2">
                {node.riskReasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-gray-700 bg-amber-50 p-2 rounded"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Merged Nodes (for SuperNodes) */}
          {isSuperNode && node.mergedNodes && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">
                Merged Sources ({node.mergedCount})
              </h4>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {node.mergedNodes.map((merged) => (
                  <div
                    key={merged.id}
                    className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded hover:bg-gray-100"
                  >
                    <ChevronRight className="h-3 w-3 text-gray-400" />
                    <span className="truncate flex-1">{merged.label}</span>
                    {merged.location?.file && (
                      <span className="text-xs text-gray-400 font-mono">
                        {merged.location.file.split('/').pop()}
                        {merged.location.line && `:${merged.location.line}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Findings */}
          {relatedFindings.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">
                Related Findings ({relatedFindings.length})
              </h4>
              <div className="space-y-2">
                {relatedFindings.map((finding) => (
                  <button
                    key={finding.id}
                    onClick={() => onFindingClick?.(finding.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-colors hover:shadow-sm',
                      severityStyles[finding.severity]
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{finding.pattern}</span>
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </div>
                    <p className="text-xs line-clamp-2">{finding.message}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] opacity-75">
                      <span>Line {finding.line}</span>
                      {finding.cwe && <span>&bull; {finding.cwe}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No Findings */}
          {!node.isGhost && relatedFindings.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No findings associated with this node</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default TopologyNodeSheet;
