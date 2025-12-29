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
  SAFE: { badge: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300', text: 'text-green-600 dark:text-green-400' },
  LOW: { badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300', text: 'text-blue-600 dark:text-blue-400' },
  MEDIUM: { badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300', text: 'text-amber-600 dark:text-amber-400' },
  HIGH: { badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300', text: 'text-orange-600 dark:text-orange-400' },
  CRITICAL: { badge: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300', text: 'text-red-600 dark:text-red-400' },
};

// Severity styling for findings
const severityStyles: Record<string, string> = {
  CRITICAL: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
  HIGH: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  MEDIUM: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  LOW: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
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
 * Find findings related to a node.
 *
 * Uses a two-phase approach:
 * 1. First, look for exact matches via topology_node_id (precise linkage)
 * 2. If no explicit matches, fall back to file + line proximity matching
 *
 * This ensures backward compatibility while enabling precise finding-to-node linkage.
 */
function findRelatedFindings(node: SelectedNodeData, findings: Finding[]): Finding[] {
  // Phase 1: Check for explicit topology_node_id matches
  const exactMatches = findings.filter((f) => f.topology_node_id === node.id);
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // Phase 2: Fall back to file + line proximity matching (backward compatibility)
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
                node.isGhost ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'
              )}
            >
              {isSuperNode ? (
                <Files className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <Icon
                  className={cn('h-5 w-5', node.isGhost ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300')}
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
              {node.type === 'ToolCall' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {['eval', 'exec', 'compile', 'system', 'popen', 'os.system', 'subprocess'].some(fn =>
                    node.label.toLowerCase().includes(fn)
                  )
                    ? 'Dangerous function that can execute arbitrary code'
                    : 'External function or tool call'
                  }
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Risk Level Badge */}
          {!node.isGhost && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Risk Level</h4>
              <span className={cn('px-3 py-1 rounded-full text-sm font-medium', riskStyle.badge)}>
                {node.riskLevel}
              </span>
            </div>
          )}

          {/* Ghost Node Info with Actionable Remediation */}
          {node.isGhost && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Missing: {node.missingControl?.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400">
                  Required for compliance with AI governance frameworks.
                </p>
              </div>
              <GhostNodeRemediation controlType={node.missingControl} />
            </div>
          )}

          {/* Risk Reasons */}
          {node.riskReasons && node.riskReasons.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Risk Factors</h4>
              <ul className="space-y-2">
                {node.riskReasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 bg-amber-50 dark:bg-amber-900/20 p-2 rounded"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Merged Nodes (for SuperNodes) */}
          {isSuperNode && node.mergedNodes && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Merged Sources ({node.mergedCount})
              </h4>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {node.mergedNodes.map((merged) => (
                  <div
                    key={merged.id}
                    className="flex items-center gap-2 text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ChevronRight className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                    <span className="truncate flex-1 text-gray-700 dark:text-gray-300">{merged.label}</span>
                    {merged.location?.file && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
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
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
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
                    {/* CVE and Threat References */}
                    {(finding.cve_references?.length || finding.owasp_agentic_threat || finding.palo_alto_threat) && (
                      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-current/10">
                        {finding.owasp_agentic_threat && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                            OWASP {finding.owasp_agentic_threat}
                          </span>
                        )}
                        {finding.palo_alto_threat && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                            Unit42 #{finding.palo_alto_threat}
                          </span>
                        )}
                        {finding.cve_references?.slice(0, 2).map((cve) => (
                          <span
                            key={cve}
                            className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded"
                          >
                            {cve}
                          </span>
                        ))}
                        {finding.cve_references && finding.cve_references.length > 2 && (
                          <span className="text-[10px] opacity-60">+{finding.cve_references.length - 2} more</span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No Findings */}
          {!node.isGhost && relatedFindings.length === 0 && (
            <div className="text-center py-6 text-gray-400 dark:text-gray-500">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No findings associated with this node</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Ghost node remediation guidance with LangChain code examples.
 */
function GhostNodeRemediation({ controlType }: { controlType?: string }) {
  const remediations: Record<string, { title: string; steps: string[]; code: string }> = {
    human_approval: {
      title: "Add Human Approval",
      steps: [
        "Add HumanApprovalCallbackHandler to your agent",
        "Configure approval for high-risk tool calls",
      ],
      code: `from langchain.callbacks import HumanApprovalCallbackHandler

# Require human approval for sensitive operations
agent = initialize_agent(
    tools=tools,
    llm=llm,
    callbacks=[HumanApprovalCallbackHandler()]
)`,
    },
    human_oversight: {
      title: "Add Human Oversight",
      steps: [
        "Implement approval workflow for critical actions",
        "Log all agent decisions for audit",
      ],
      code: `from langchain.callbacks import HumanApprovalCallbackHandler

def should_approve(action: str) -> bool:
    # High-risk actions require human approval
    HIGH_RISK = ["delete", "transfer", "execute", "admin"]
    return not any(r in action.lower() for r in HIGH_RISK)

agent = initialize_agent(
    tools=tools,
    llm=llm,
    callbacks=[HumanApprovalCallbackHandler(
        should_check=lambda inp: not should_approve(inp['action'])
    )]
)`,
    },
    rate_limiting: {
      title: "Add Rate Limiting",
      steps: [
        "Wrap LLM calls with rate limiter",
        "Set per-user and per-IP limits",
      ],
      code: `from ratelimit import limits, sleep_and_retry

# Limit to 10 requests per minute
@sleep_and_retry
@limits(calls=10, period=60)
def get_completion(prompt: str) -> str:
    return llm.predict(prompt)`,
    },
    authorization_check: {
      title: "Add Authorization",
      steps: [
        "Add permission checks before tool execution",
        "Validate user context on each request",
      ],
      code: `def execute_tool(user, tool_name: str, params: dict):
    # Check user permissions before execution
    if not user.can_access(tool_name):
        raise PermissionError(f"Unauthorized: {tool_name}")
    return tools[tool_name].run(params)`,
    },
    auth_checks: {
      title: "Add Authorization Checks",
      steps: [
        "Verify user identity before agent operations",
        "Implement role-based access control",
      ],
      code: `from functools import wraps

def require_auth(permission: str):
    def decorator(func):
        @wraps(func)
        def wrapper(user, *args, **kwargs):
            if not user.has_permission(permission):
                raise PermissionError(f"Missing: {permission}")
            return func(user, *args, **kwargs)
        return wrapper
    return decorator

@require_auth("agent:execute")
def run_agent(user, query: str):
    return agent.invoke(query)`,
    },
    audit_logging: {
      title: "Add Audit Logging",
      steps: [
        "Log all agent actions with timestamps",
        "Include user context in audit trail",
      ],
      code: `import logging
from datetime import datetime

audit_logger = logging.getLogger("audit")

def log_action(user_id: str, action: str, result: str):
    audit_logger.info(
        f"[{datetime.utcnow().isoformat()}] "
        f"user={user_id} action={action} result={result}"
    )

# Usage in agent callback
class AuditCallback(BaseCallbackHandler):
    def on_tool_end(self, output: str, **kwargs):
        log_action(self.user_id, kwargs.get("name"), "success")`,
    },
  };

  const rem = remediations[controlType || ""];
  if (!rem) {
    // Fallback for unknown control types
    return (
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">How to Fix</h4>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Add the missing {controlType?.replace(/_/g, " ")} control to your agent workflow
          to improve compliance with governance frameworks.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-3">{rem.title}</h4>
      <ul className="space-y-1 mb-3">
        {rem.steps.map((step, i) => (
          <li key={i} className="text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
            <span className="text-blue-500 font-medium">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ul>
      <pre className="text-xs bg-white/50 dark:bg-gray-900/50 p-3 rounded border border-blue-200 dark:border-blue-800 overflow-x-auto font-mono text-gray-800 dark:text-gray-200">
        {rem.code}
      </pre>
    </div>
  );
}

export default TopologyNodeSheet;
