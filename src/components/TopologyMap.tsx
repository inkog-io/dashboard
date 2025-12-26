'use client';

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

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
  CheckCircle,
  XCircle,
  Download,
  FileCode,
  Image,
  AlertTriangle,
  Files,
  UserX,
  ShieldOff,
} from 'lucide-react';
import type { TopologyMap, TopologyNode as APITopologyNode, TopologyEdge as APITopologyEdge, GovernanceStatus, Finding } from '@/lib/api';
import { cn } from '@/lib/utils';
import GhostNode, { GhostNodeData, MissingControlType } from './topology/GhostNode';
import SuperNode, { SuperNodeData, MergedNodeInfo } from './topology/SuperNode';
import { TopologyNodeSheet, SelectedNodeData } from './topology/TopologyNodeSheet';

// Risk level colors
const riskColors: Record<string, { bg: string; border: string; text: string }> = {
  SAFE: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  LOW: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  MEDIUM: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  HIGH: { bg: '#fed7aa', border: '#f97316', text: '#9a3412' },
  CRITICAL: { bg: '#fecaca', border: '#ef4444', text: '#991b1b' },
};

// Node type icons mapping to Lucide components
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

// Human-friendly type labels
const typeLabels: Record<string, string> = {
  SystemPrompt: 'System Context',
  LLMCall: 'LLM Call',
  ToolCall: 'Tool',
  Loop: 'Loop',
  HumanApproval: 'Human Approval',
  AuthorizationCheck: 'Auth Check',
  RateLimitConfig: 'Rate Limit',
  AuditLog: 'Audit',
  Delegation: 'Delegation',
  MemoryAccess: 'Memory',
};

// Dangerous function names that need special labeling
const dangerousFunctions = ['eval', 'exec', 'compile', 'system', 'popen', 'os.system', 'subprocess'];

/**
 * Enhance labels for dangerous functions to make them clearer.
 * Adds () suffix and warning context for dangerous ToolCall nodes.
 */
function getEnhancedLabel(label: string, type: string): string {
  if (type === 'ToolCall' && dangerousFunctions.some(fn => label.toLowerCase().includes(fn))) {
    return `${label}()`;
  }
  return label;
}

interface CustomNodeData {
  label: string;
  type: string;
  riskLevel: string;
  riskReasons?: string[];
  location?: { file?: string; line?: number };
  onClick?: () => void;
}

/**
 * Simplified custom node - clean display with icon + name only.
 * All details are shown in the sheet on click.
 */
function TopologyCustomNode({ data }: { data: CustomNodeData }) {
  const Icon = nodeIconMap[data.type] || nodeIconMap.Default;
  const colors = riskColors[data.riskLevel] || riskColors.LOW;
  const hasRisks = data.riskReasons && data.riskReasons.length > 0;

  return (
    <div
      className="relative cursor-pointer hover:shadow-lg transition-shadow"
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />

      <div
        className="px-4 py-2.5 rounded-lg shadow-md border-2 min-w-[100px]"
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
        }}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 flex-shrink-0" style={{ color: colors.text }} />
          <span
            className="text-sm font-medium truncate max-w-[120px]"
            style={{ color: colors.text }}
            title={data.type === 'ToolCall' ? `${data.label} - Function call` : data.label}
          >
            {getEnhancedLabel(data.label, data.type)}
          </span>
        </div>
      </div>

      {/* Small risk indicator dot (not full badge) */}
      {hasRisks && (
        <div className="absolute -top-1 -right-1 bg-red-500 rounded-full w-2.5 h-2.5 shadow" />
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = {
  custom: TopologyCustomNode,
  ghostNode: GhostNode,
  superNode: SuperNode,
};

// Simple grid fallback layout when dagre fails
function simpleGridLayout<T extends { position: { x: number; y: number } }>(nodes: T[], startY: number = 80): T[] {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  return nodes.map((node, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      ...node,
      position: {
        x: 100 + col * 200,
        y: startY + row * 100,
      },
    };
  });
}

/**
 * Position ghost nodes in a fixed row at the top.
 * Ghost nodes don't go through dagre - they have explicit positions.
 */
function positionGhostNodes(ghostNodes: Node[]): Node[] {
  if (ghostNodes.length === 0) return [];

  const GHOST_Y = 30;
  const GHOST_SPACING = 190;
  // Center the ghost row
  const totalWidth = (ghostNodes.length - 1) * GHOST_SPACING;
  const startX = Math.max(50, 400 - totalWidth / 2);

  return ghostNodes.map((node, index) => ({
    ...node,
    position: {
      x: startX + index * GHOST_SPACING,
      y: GHOST_Y,
    },
  }));
}

/**
 * Layout regular nodes using dagre, offsetting down to leave room for ghost row.
 */
function layoutRegularNodes(
  nodes: Node[],
  edges: Edge[],
  hasGhostNodes: boolean
): Node[] {
  if (nodes.length === 0) return [];

  const GHOST_ROW_HEIGHT = hasGhostNodes ? 100 : 0;

  try {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'TB',
      ranksep: 70,
      nodesep: 40,
      marginx: 30,
      marginy: 30,
    });
    g.setDefaultEdgeLabel(() => ({}));

    const nodeIds = new Set(nodes.map((n) => n.id));

    nodes.forEach((node) => {
      const width = 150;
      const height = 50;
      g.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    });

    dagre.layout(g);

    return nodes.map((node) => {
      const nodeWithPosition = g.node(node.id);
      if (!nodeWithPosition) return node;

      return {
        ...node,
        position: {
          x: nodeWithPosition.x - 75,
          y: nodeWithPosition.y - 25 + GHOST_ROW_HEIGHT,
        },
      };
    });
  } catch (error) {
    console.error('Dagre layout failed, using grid fallback:', error);
    return simpleGridLayout(nodes, GHOST_ROW_HEIGHT + 30);
  }
}

/**
 * Merge leaf nodes of the same type that connect to the same target.
 * Returns merged nodes and updated edges.
 */
function mergeLeafNodes(
  nodes: APITopologyNode[],
  edges: APITopologyEdge[]
): {
  mergedNodes: APITopologyNode[];
  mergedEdges: APITopologyEdge[];
  mergeMap: Map<string, APITopologyNode[]>;
} {
  // Find which nodes have incoming edges (not leaves)
  const hasIncoming = new Set(edges.map((e) => e.to));

  // Group leaf nodes by: type + outgoing targets
  const groups = new Map<string, APITopologyNode[]>();

  nodes.forEach((node) => {
    // Only consider nodes without incoming edges (true leaves)
    // But include nodes that are sources (have outgoing edges)
    const outgoing = edges
      .filter((e) => e.from === node.id && e.type !== 'contains')
      .map((e) => e.to)
      .sort()
      .join(',');

    // Only group if this is a "feedable" type and has same outgoing targets
    const mergableTypes = ['SystemPrompt', 'MemoryAccess', 'Delegation'];
    if (mergableTypes.includes(node.type) && outgoing) {
      const key = `${node.type}:${outgoing}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(node);
    }
  });

  const mergedNodes: APITopologyNode[] = [];
  const mergeMap = new Map<string, APITopologyNode[]>();
  const mergedNodeIds = new Set<string>();

  // Process groups - merge those with 2+ nodes
  groups.forEach((group) => {
    if (group.length >= 2) {
      // Create supernode
      const superNodeId = `super-${group[0].id}`;
      const typeLabel = typeLabels[group[0].type] || group[0].type;

      const superNode: APITopologyNode = {
        ...group[0],
        id: superNodeId,
        label: `${typeLabel} (${group.length})`,
        data: {
          ...group[0].data,
          isSuperNode: true,
          mergedCount: group.length,
          mergedNodes: group.map((n) => ({
            id: n.id,
            label: n.label,
            location: n.location,
          })),
        },
      };

      mergedNodes.push(superNode);
      mergeMap.set(superNodeId, group);
      group.forEach((n) => mergedNodeIds.add(n.id));
    }
  });

  // Add non-merged nodes
  nodes.forEach((node) => {
    if (!mergedNodeIds.has(node.id)) {
      mergedNodes.push(node);
    }
  });

  // Update edges to point to supernodes
  const mergedEdges: APITopologyEdge[] = [];
  const addedEdges = new Set<string>();

  edges.forEach((edge) => {
    if (edge.type === 'contains') return; // Skip containment edges

    let newFrom = edge.from;
    let newTo = edge.to;

    // Check if source was merged
    mergeMap.forEach((group, superNodeId) => {
      if (group.some((n) => n.id === edge.from)) {
        newFrom = superNodeId;
      }
      if (group.some((n) => n.id === edge.to)) {
        newTo = superNodeId;
      }
    });

    const edgeKey = `${newFrom}-${newTo}`;
    if (!addedEdges.has(edgeKey)) {
      addedEdges.add(edgeKey);
      mergedEdges.push({
        ...edge,
        from: newFrom,
        to: newTo,
      });
    }
  });

  return { mergedNodes, mergedEdges, mergeMap };
}

/**
 * Find high-risk nodes that should be protected by governance controls.
 * These are nodes that would benefit from human oversight, auth, rate limiting, or audit.
 */
function findHighRiskNodes(nodes: APITopologyNode[]): APITopologyNode[] {
  return nodes.filter((node) => {
    // High-risk node types that need governance
    const highRiskTypes = ['ToolCall', 'LLMCall', 'Delegation'];
    const isHighRiskType = highRiskTypes.includes(node.type);

    // Check if node has risk indicators
    const isDangerous = node.data?.is_dangerous === true;
    const isHighRisk = node.risk_level === 'HIGH' || node.risk_level === 'CRITICAL';

    return isHighRiskType || isDangerous || isHighRisk;
  });
}

/**
 * Maps governance control types to the node types they should protect.
 * This ensures ghost nodes connect to semantically appropriate targets.
 */
const controlTargetTypes: Record<string, string[]> = {
  human_oversight: ['ToolCall', 'Delegation'], // Human review for actions/delegations
  authorization: ['ToolCall', 'LLMCall'],      // Auth before operations
  rate_limit: ['LLMCall', 'ToolCall'],         // Rate limit API calls
  audit_log: ['ToolCall', 'LLMCall', 'Delegation'], // Audit everything
};

/**
 * Inject ghost nodes for missing governance controls.
 * Ghost nodes are connected to semantically appropriate high-risk nodes
 * based on what each control type should protect.
 */
function injectGhostNodes(
  governance: GovernanceStatus,
  highRiskNodes: APITopologyNode[]
): { nodes: Node<GhostNodeData>[]; edges: Edge[] } {
  const ghostNodes: Node<GhostNodeData>[] = [];
  const ghostEdges: Edge[] = [];

  /**
   * Find target nodes for a specific control type.
   * Returns nodes whose type matches what this control should protect.
   */
  function findTargetsForControl(controlType: keyof typeof controlTargetTypes): APITopologyNode[] {
    const targetTypes = controlTargetTypes[controlType] || [];
    return highRiskNodes.filter((node) => {
      // Match by node type
      if (targetTypes.includes(node.type)) return true;
      // Also include if explicitly dangerous
      if (node.data?.is_dangerous) return true;
      return false;
    });
  }

  /**
   * Create ghost edges from a ghost node to appropriate target nodes.
   * Limits to first 2 targets for visual clarity.
   */
  function createGhostEdges(ghostId: string, targets: APITopologyNode[]): Edge[] {
    // Limit edges to avoid visual clutter (max 2 per ghost)
    const limitedTargets = targets.slice(0, 2);

    return limitedTargets.map((target) => ({
      id: `edge-${ghostId}-${target.id}`,
      source: ghostId,
      target: target.id,
      animated: false,
      style: {
        stroke: '#ef4444',
        strokeWidth: 2,
        strokeDasharray: '8,4',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#ef4444',
        width: 14,
        height: 14,
      },
      label: 'should guard',
      labelStyle: { fill: '#ef4444', fontSize: 10 },
      labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
    }));
  }

  if (!governance.has_human_oversight) {
    const ghostId = 'ghost-oversight';
    ghostNodes.push({
      id: ghostId,
      type: 'ghostNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Human Oversight',
        missingControl: 'human_oversight',
        isGhost: true,
      },
    });

    const targets = findTargetsForControl('human_oversight');
    ghostEdges.push(...createGhostEdges(ghostId, targets));
  }

  if (!governance.has_auth_checks) {
    const ghostId = 'ghost-auth';
    ghostNodes.push({
      id: ghostId,
      type: 'ghostNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Authorization',
        missingControl: 'authorization',
        isGhost: true,
      },
    });

    const targets = findTargetsForControl('authorization');
    ghostEdges.push(...createGhostEdges(ghostId, targets));
  }

  if (!governance.has_rate_limiting) {
    const ghostId = 'ghost-ratelimit';
    ghostNodes.push({
      id: ghostId,
      type: 'ghostNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Rate Limiting',
        missingControl: 'rate_limit',
        isGhost: true,
      },
    });

    const targets = findTargetsForControl('rate_limit');
    ghostEdges.push(...createGhostEdges(ghostId, targets));
  }

  if (!governance.has_audit_logging) {
    const ghostId = 'ghost-audit';
    ghostNodes.push({
      id: ghostId,
      type: 'ghostNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Audit Logging',
        missingControl: 'audit_log',
        isGhost: true,
      },
    });

    const targets = findTargetsForControl('audit_log');
    ghostEdges.push(...createGhostEdges(ghostId, targets));
  }

  return { nodes: ghostNodes, edges: ghostEdges };
}

// Convert API topology to ReactFlow format with deduplication and ghost nodes
function convertToReactFlow(
  topology: TopologyMap,
  onNodeClick: (nodeData: SelectedNodeData) => void
): { nodes: Node[]; edges: Edge[] } {
  // Step 1: Merge leaf nodes (deduplication)
  const { mergedNodes, mergedEdges, mergeMap } = mergeLeafNodes(
    topology.nodes,
    topology.edges
  );

  const validNodeIds = new Set(mergedNodes.map((n) => n.id));

  // Step 2: Convert merged nodes to ReactFlow format
  const flowNodes: Node[] = mergedNodes.map((node) => {
    const isSuperNode = node.data?.isSuperNode === true;

    if (isSuperNode) {
      // SuperNode
      return {
        id: node.id,
        type: 'superNode',
        position: { x: 0, y: 0 },
        data: {
          label: node.label,
          type: node.type,
          mergedCount: node.data.mergedCount as number,
          mergedNodes: node.data.mergedNodes as MergedNodeInfo[],
          riskLevel: node.risk_level,
          onClick: () =>
            onNodeClick({
              id: node.id,
              label: node.label,
              type: node.type,
              riskLevel: node.risk_level,
              riskReasons: node.risk_reasons,
              location: node.location,
              isSuperNode: true,
              mergedCount: node.data.mergedCount as number,
              mergedNodes: node.data.mergedNodes as MergedNodeInfo[],
            }),
        } as SuperNodeData & { onClick: () => void },
      };
    }

    // Regular node
    return {
      id: node.id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: node.label,
        type: node.type,
        riskLevel: node.risk_level,
        riskReasons: node.risk_reasons,
        location: node.location,
        onClick: () =>
          onNodeClick({
            id: node.id,
            label: node.label,
            type: node.type,
            riskLevel: node.risk_level,
            riskReasons: node.risk_reasons,
            location: node.location,
          }),
      } as CustomNodeData,
    };
  });

  // Step 3: Create edges with improved styling
  const flowEdges: Edge[] = mergedEdges
    .filter((e) => validNodeIds.has(e.from) && validNodeIds.has(e.to))
    .map((edge, index) => {
      const isDataFlow = edge.type === 'feeds_data_to' || edge.type === 'data_flow';
      const isGuard = edge.type === 'guards';
      const isFollows = edge.type === 'follows';

      // Better edge colors
      let strokeColor = '#6366f1'; // Indigo for flow
      if (isGuard) strokeColor = '#22c55e'; // Green for guards
      if (isDataFlow) strokeColor = '#8b5cf6'; // Purple for data

      return {
        id: `e${index}-${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        animated: isDataFlow || isFollows,
        style: {
          stroke: strokeColor,
          strokeWidth: 2,
          strokeDasharray: isGuard ? '5,5' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 16,
          height: 16,
        },
        label: isGuard ? 'guards' : undefined,
        labelStyle: isGuard ? { fill: '#22c55e', fontSize: 10, fontWeight: 500 } : undefined,
        labelBgStyle: isGuard ? { fill: 'white', fillOpacity: 0.9 } : undefined,
      };
    });

  // Step 4: Find high-risk nodes for ghost connections
  const highRiskNodes = findHighRiskNodes(mergedNodes);

  // Step 5: Inject ghost nodes for missing controls (with edges to high-risk nodes)
  // Ghost nodes connect to semantically appropriate nodes by control type
  const { nodes: ghostNodes, edges: ghostEdges } = injectGhostNodes(
    topology.governance,
    highRiskNodes
  );

  // Add click handlers to ghost nodes
  ghostNodes.forEach((ghost) => {
    (ghost.data as GhostNodeData & { onClick?: () => void }).onClick = () =>
      onNodeClick({
        id: ghost.id,
        label: ghost.data.label,
        type: 'GhostNode',
        riskLevel: 'CRITICAL',
        isGhost: true,
        missingControl: ghost.data.missingControl,
      });
  });

  // Step 6: Combine all edges (regular + ghost)
  const allEdges = [...flowEdges, ...ghostEdges];

  // Step 7: Position ghost nodes in fixed row at top (NOT through dagre)
  const positionedGhosts = positionGhostNodes(ghostNodes);

  // Step 8: Layout regular nodes with dagre, offset down if ghosts exist
  const layoutedRegular = layoutRegularNodes(flowNodes, allEdges, ghostNodes.length > 0);

  // Step 9: Combine positioned nodes
  const allNodes = [...positionedGhosts, ...layoutedRegular];

  return { nodes: allNodes, edges: allEdges };
}

// Generate Mermaid diagram string
function toMermaidString(topology: TopologyMap): string {
  const lines: string[] = ['flowchart TD'];

  topology.nodes.forEach((node) => {
    const label = node.label.replace(/"/g, "'");
    const shape =
      node.type === 'LLMCall'
        ? `[["${label}"]]`
        : node.type === 'Loop'
        ? `(("${label}"))`
        : `["${label}"]`;
    lines.push(`  ${node.id}${shape}`);
  });

  topology.edges.forEach((edge) => {
    if (edge.type === 'contains') return;
    const arrow = edge.label ? `-->|${edge.label}|` : '-->';
    lines.push(`  ${edge.from} ${arrow} ${edge.to}`);
  });

  const styleMap: Record<string, string> = {
    CRITICAL: 'fill:#fecaca,stroke:#ef4444,stroke-width:2px',
    HIGH: 'fill:#fed7aa,stroke:#f97316,stroke-width:2px',
    MEDIUM: 'fill:#fef3c7,stroke:#f59e0b,stroke-width:2px',
    LOW: 'fill:#dbeafe,stroke:#3b82f6,stroke-width:2px',
    SAFE: 'fill:#dcfce7,stroke:#22c55e,stroke-width:2px',
  };

  topology.nodes.forEach((node) => {
    const style = styleMap[node.risk_level] || styleMap.SAFE;
    lines.push(`  style ${node.id} ${style}`);
  });

  return lines.join('\n');
}

interface TopologyMapProps {
  topology?: TopologyMap;
  findings?: Finding[];
  onFindingClick?: (findingId: string) => void;
}

export function TopologyMapVisualization({ topology, findings = [], onFindingClick }: TopologyMapProps) {
  const [selectedNode, setSelectedNode] = useState<SelectedNodeData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleNodeClick = useCallback((nodeData: SelectedNodeData) => {
    setSelectedNode(nodeData);
    setSheetOpen(true);
  }, []);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!topology || topology.nodes.length === 0) {
      return { nodes: [], edges: [] };
    }
    return convertToReactFlow(topology, handleNodeClick);
  }, [topology, handleNodeClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Export handlers
  const handleMermaidExport = useCallback(() => {
    if (!topology) return;
    const mermaidCode = toMermaidString(topology);
    const blob = new Blob([mermaidCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent-topology.mmd';
    a.click();
    URL.revokeObjectURL(url);
  }, [topology]);

  const handleSVGExport = useCallback(() => {
    const svg = document.querySelector('.react-flow__viewport');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent-topology.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handlePNGExport = useCallback(async () => {
    const viewport = document.querySelector('.react-flow__viewport');
    if (!viewport) return;

    try {
      const svgData = new XMLSerializer().serializeToString(viewport);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new window.Image();

      canvas.width = 800;
      canvas.height = 600;

      img.onload = () => {
        ctx?.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'agent-topology.png';
        a.click();
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (err) {
      console.error('PNG export failed:', err);
      handleSVGExport();
    }
  }, [handleSVGExport]);

  if (!topology || topology.nodes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Agent Topology</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">No topology data available for this scan.</p>
      </div>
    );
  }

  // Count missing controls for the header
  const missingControlCount = [
    !topology.governance.has_human_oversight,
    !topology.governance.has_auth_checks,
    !topology.governance.has_audit_logging,
    !topology.governance.has_rate_limiting,
  ].filter(Boolean).length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Agent Topology</h3>
          {missingControlCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded-full">
              <AlertTriangle className="h-3 w-3" />
              {missingControlCount} missing
            </span>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleMermaidExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FileCode className="h-3.5 w-3.5" />
            Mermaid
          </button>
          <button
            onClick={handleSVGExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            SVG
          </button>
          <button
            onClick={handlePNGExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Image className="h-3.5 w-3.5" />
            PNG
          </button>
        </div>
      </div>

      {/* Compact Governance Status - only shown if all controls present */}
      {missingControlCount === 0 && (
        <div className="px-5 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-900 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          All governance controls in place
        </div>
      )}

      {/* ReactFlow Canvas */}
      <div className="h-[400px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="!shadow-lg !border !border-gray-200 dark:!border-gray-700 !rounded-lg !bg-white dark:!bg-gray-800" />
          <Background color="#e5e7eb" gap={20} className="dark:!bg-gray-950" />
          <MiniMap
            className="!bg-white dark:!bg-gray-800 !border !border-gray-200 dark:!border-gray-700 !rounded-lg !shadow-sm"
            nodeColor={(node) => {
              if (node.type === 'ghostNode') return '#ef4444';
              const colors = riskColors[node.data?.riskLevel] || riskColors.SAFE;
              return colors.border;
            }}
          />
        </ReactFlow>
      </div>

      {/* Complete Legend */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400 justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Risk colors - complete set */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/50 border-2 border-green-500" />
            <span>Safe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/50 border-2 border-amber-500" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900/50 border-2 border-orange-500" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/50 border-2 border-red-500" />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
            <div className="w-3 h-3 rounded border-2 border-dashed border-red-400" />
            <span>Missing Control</span>
          </div>
          {/* Edge types */}
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
            <div className="w-4 h-0 border-t-2 border-dashed border-green-500" />
            <span>Guards</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0 border-t-2 border-dashed border-red-400" />
            <span>Should Guard</span>
          </div>
        </div>
        <span className="text-gray-400 dark:text-gray-500">
          Click nodes for details
        </span>
      </div>

      {/* Node Detail Sheet */}
      <TopologyNodeSheet
        node={selectedNode}
        findings={findings}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onFindingClick={onFindingClick}
      />
    </div>
  );
}

export default TopologyMapVisualization;
