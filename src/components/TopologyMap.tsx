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
          >
            {data.label}
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
function simpleGridLayout<T extends { position: { x: number; y: number } }>(nodes: T[]): T[] {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  return nodes.map((node, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      ...node,
      position: {
        x: 100 + col * 220,
        y: 80 + row * 100,
      },
    };
  });
}

// Layout nodes using dagre for hierarchical graph positioning
function layoutWithDagre(
  nodes: Node[],
  edges: Edge[],
): Node[] {
  try {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'TB',
      ranksep: 80,   // More vertical space
      nodesep: 50,   // More horizontal space
      marginx: 40,
      marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));

    const nodeIds = new Set(nodes.map((n) => n.id));

    // Add nodes with sizing based on type
    nodes.forEach((node) => {
      let width = 160;
      let height = 60;

      if (node.type === 'ghostNode') {
        width = 180;
        height = 55;
      } else if (node.type === 'superNode') {
        width = 180;
        height = 65;
      }

      g.setNode(node.id, { width, height });
    });

    // Add edges
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
          x: nodeWithPosition.x - 80,
          y: nodeWithPosition.y - 30,
        },
      };
    });
  } catch (error) {
    console.error('Dagre layout failed, using grid fallback:', error);
    return simpleGridLayout(nodes);
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
 * Inject ghost nodes for missing governance controls.
 * Ghost nodes are positioned at the top of the graph.
 */
function injectGhostNodes(
  governance: GovernanceStatus
): Node<GhostNodeData>[] {
  const ghostNodes: Node<GhostNodeData>[] = [];

  if (!governance.has_human_oversight) {
    ghostNodes.push({
      id: 'ghost-oversight',
      type: 'ghostNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Human Oversight',
        missingControl: 'human_oversight',
        isGhost: true,
      },
    });
  }

  if (!governance.has_auth_checks) {
    ghostNodes.push({
      id: 'ghost-auth',
      type: 'ghostNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Authorization',
        missingControl: 'authorization',
        isGhost: true,
      },
    });
  }

  if (!governance.has_rate_limiting) {
    ghostNodes.push({
      id: 'ghost-ratelimit',
      type: 'ghostNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Rate Limiting',
        missingControl: 'rate_limit',
        isGhost: true,
      },
    });
  }

  if (!governance.has_audit_logging) {
    ghostNodes.push({
      id: 'ghost-audit',
      type: 'ghostNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Audit Logging',
        missingControl: 'audit_log',
        isGhost: true,
      },
    });
  }

  return ghostNodes;
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

  // Step 3: Inject ghost nodes for missing controls
  const ghostNodes = injectGhostNodes(topology.governance);

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

  // Step 4: Create edges
  const flowEdges: Edge[] = mergedEdges
    .filter((e) => validNodeIds.has(e.from) && validNodeIds.has(e.to))
    .map((edge, index) => {
      const isDataFlow = edge.type === 'feeds_data_to' || edge.type === 'data_flow';
      const isGuard = edge.type === 'guards';

      return {
        id: `e${index}-${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        animated: isDataFlow,
        style: {
          stroke: isGuard ? '#22c55e' : '#94a3b8',
          strokeWidth: 2,
          strokeDasharray: isGuard ? '5,5' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isGuard ? '#22c55e' : '#94a3b8',
        },
      };
    });

  // Step 5: Combine all nodes (ghosts first for top positioning)
  const allNodes = [...ghostNodes, ...flowNodes];

  // Step 6: Apply layout
  const layoutedNodes = layoutWithDagre(allNodes, flowEdges);

  return { nodes: layoutedNodes, edges: flowEdges };
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Topology</h3>
        <p className="text-gray-500 text-sm">No topology data available for this scan.</p>
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Agent Topology</h3>
          {missingControlCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
              <AlertTriangle className="h-3 w-3" />
              {missingControlCount} missing
            </span>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleMermaidExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <FileCode className="h-3.5 w-3.5" />
            Mermaid
          </button>
          <button
            onClick={handleSVGExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            SVG
          </button>
          <button
            onClick={handlePNGExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Image className="h-3.5 w-3.5" />
            PNG
          </button>
        </div>
      </div>

      {/* Compact Governance Status - only shown if all controls present */}
      {missingControlCount === 0 && (
        <div className="px-5 py-2 bg-green-50 border-b border-green-100 text-sm text-green-700 flex items-center gap-2">
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
          <Controls className="!shadow-lg !border !border-gray-200 !rounded-lg" />
          <Background color="#e5e7eb" gap={20} />
          <MiniMap
            className="!bg-white !border !border-gray-200 !rounded-lg !shadow-sm"
            nodeColor={(node) => {
              if (node.type === 'ghostNode') return '#ef4444';
              const colors = riskColors[node.data?.riskLevel] || riskColors.SAFE;
              return colors.border;
            }}
          />
        </ReactFlow>
      </div>

      {/* Simplified Legend */}
      <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-600 justify-between">
        <div className="flex items-center gap-4">
          {/* Risk colors */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-100 border-2 border-green-500" />
            <span>Safe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-100 border-2 border-amber-500" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-100 border-2 border-red-500" />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-200">
            <div className="w-3 h-3 rounded border-2 border-dashed border-red-400" />
            <span>Missing Control</span>
          </div>
        </div>
        <span className="text-gray-400">
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
