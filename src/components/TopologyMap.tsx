'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
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
} from 'lucide-react';
import type { TopologyMap, TopologyNode as APITopologyNode } from '@/lib/api';
import { cn } from '@/lib/utils';
import GroupNode from './topology/GroupNode';

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

interface CustomNodeData {
  label: string;
  type: string;
  riskLevel: string;
  riskReasons?: string[];
  location?: { file?: string; line?: number };
}

// Custom node component with Lucide icons
function TopologyCustomNode({ data }: { data: CustomNodeData }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const Icon = nodeIconMap[data.type] || nodeIconMap.Default;
  const colors = riskColors[data.riskLevel] || riskColors.LOW;

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      <div
        className="px-4 py-3 rounded-lg shadow-md border-2 min-w-[120px]"
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
        }}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: colors.text }} />
          <span
            className="text-sm font-medium truncate max-w-[100px]"
            style={{ color: colors.text }}
          >
            {data.label}
          </span>
        </div>

        {/* Risk badge */}
        {data.riskReasons && data.riskReasons.length > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
            {data.riskReasons.length}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />

      {/* Tooltip */}
      {showTooltip && (data.riskReasons?.length || data.location?.file) && (
        <div className="absolute z-50 left-full ml-2 top-0 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg min-w-[200px]">
          <p className="font-medium mb-1">{data.label}</p>
          <p className="text-gray-400 text-[10px] uppercase mb-2">{data.type}</p>

          {data.location?.file && (
            <p className="text-gray-300 text-[10px] mb-2">
              {data.location.file}
              {data.location.line && `:${data.location.line}`}
            </p>
          )}

          {data.riskReasons && data.riskReasons.length > 0 && (
            <div className="border-t border-gray-700 pt-2 mt-2">
              <p className="text-amber-400 text-[10px] uppercase mb-1">Risks</p>
              <ul className="space-y-1">
                {data.riskReasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="text-[10px]">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  custom: TopologyCustomNode,
  groupNode: GroupNode,
};

// Layout nodes using dagre for hierarchical graph positioning
function layoutWithDagre(
  nodes: Node<CustomNodeData>[],
  edges: Edge[],
  parentMap: Map<string, string>
): Node<CustomNodeData>[] {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({
    rankdir: 'TB',
    ranksep: 60,
    nodesep: 40,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Create a set of existing node IDs for validation
  // This prevents crashes when edges/parents reference non-existent nodes
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    const isGroup = node.type === 'groupNode';
    const width = isGroup ? 340 : 160;
    const height = isGroup ? 220 : 70;
    g.setNode(node.id, { width, height });

    // Set parent relationship for compound graph
    // Only set parent if parent exists in the graph
    const parentId = parentMap.get(node.id);
    if (parentId && nodeIds.has(parentId)) {
      g.setParent(node.id, parentId);
    }
  });

  // Add edges to dagre graph
  // Only add edges where both source and target exist
  edges.forEach((edge) => {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  // Run layout
  dagre.layout(g);

  // Apply computed positions
  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) {
      return node;
    }

    const isGroup = node.type === 'groupNode';
    const width = isGroup ? 340 : 160;
    const height = isGroup ? 220 : 70;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
      style: isGroup
        ? { width: 340, height: 220 }
        : undefined,
    };
  });
}

// Convert API topology to ReactFlow format
function convertToReactFlow(
  topology: TopologyMap
): { nodes: Node<CustomNodeData>[]; edges: Edge[] } {
  // Build parent-child map from containment edges
  // Key: childId, Value: parentId
  const parentMap = new Map<string, string>();
  const containmentEdges = topology.edges.filter((e) => e.type === 'contains');

  containmentEdges.forEach((edge) => {
    parentMap.set(edge.to, edge.from); // child → parent
  });

  // Build a set of valid node IDs for validation
  const validNodeIds = new Set(topology.nodes.map((n) => n.id));

  // Find which nodes are group containers (have children)
  // Only count as group if the parent actually exists
  const groupNodeIds = new Set<string>();
  containmentEdges.forEach((edge) => {
    if (validNodeIds.has(edge.from)) {
      groupNodeIds.add(edge.from);
    }
  });

  // Convert nodes with parentNode for contained nodes
  const nodes: Node<CustomNodeData>[] = topology.nodes.map((node) => {
    const parentId = parentMap.get(node.id);
    // Only set parentNode if the parent actually exists in the nodes
    const validParentId = parentId && validNodeIds.has(parentId) ? parentId : undefined;
    const isGroup = groupNodeIds.has(node.id);

    return {
      id: node.id,
      type: isGroup ? 'groupNode' : 'custom',
      position: { x: 0, y: 0 }, // Will be set by dagre
      data: {
        label: node.label,
        type: node.type,
        riskLevel: node.risk_level,
        riskReasons: node.risk_reasons,
        location: node.location,
      },
      // ReactFlow sub-flow properties - only set if parent is valid
      parentNode: validParentId,
      extent: validParentId ? 'parent' as const : undefined,
      // Group nodes need expandParent so children can expand them
      expandParent: !!validParentId,
    };
  });

  // Create edges for non-containment relationships only
  // "contains" relationships are expressed via parentNode hierarchy
  // Also filter out edges that reference non-existent nodes (e.g., "dynamic" delegation targets)
  const edges: Edge[] = topology.edges
    .filter((e) => e.type !== 'contains')
    .filter((e) => validNodeIds.has(e.from) && validNodeIds.has(e.to))
    .map((edge, index) => {
      // Different styling based on edge type
      const isDataFlow = edge.type === 'feeds_data_to' || edge.type === 'data_flow';
      const isGuard = edge.type === 'guards';

      return {
        id: `e${index}-${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        label: edge.label,
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
        labelStyle: { fontSize: 10, fill: '#64748b' },
        labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9 },
      };
    });

  // Apply dagre layout
  const layoutedNodes = layoutWithDagre(nodes, edges, parentMap);

  return { nodes: layoutedNodes, edges };
}

// Generate Mermaid diagram string
function toMermaidString(topology: TopologyMap): string {
  const lines: string[] = ['flowchart TD'];

  // Nodes
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

  // Edges
  topology.edges.forEach((edge) => {
    const arrow = edge.label ? `-->|${edge.label}|` : '-->';
    lines.push(`  ${edge.from} ${arrow} ${edge.to}`);
  });

  // Risk-based styling
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
}

export function TopologyMapVisualization({ topology }: TopologyMapProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!topology || topology.nodes.length === 0) {
      return { nodes: [], edges: [] };
    }
    return convertToReactFlow(topology);
  }, [topology]);

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
      // Use html-to-image or canvas approach
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
      // Fallback to SVG
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900">Agent Topology</h3>

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

      {/* Governance Status */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-4 text-sm">
        <span
          className={cn(
            'flex items-center gap-1.5',
            topology.governance.has_human_oversight ? 'text-green-600' : 'text-red-500'
          )}
        >
          {topology.governance.has_human_oversight ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Human Oversight
        </span>
        <span
          className={cn(
            'flex items-center gap-1.5',
            topology.governance.has_auth_checks ? 'text-green-600' : 'text-red-500'
          )}
        >
          {topology.governance.has_auth_checks ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Authorization
        </span>
        <span
          className={cn(
            'flex items-center gap-1.5',
            topology.governance.has_audit_logging ? 'text-green-600' : 'text-red-500'
          )}
        >
          {topology.governance.has_audit_logging ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Audit Logging
        </span>
        <span
          className={cn(
            'flex items-center gap-1.5',
            topology.governance.has_rate_limiting ? 'text-green-600' : 'text-red-500'
          )}
        >
          {topology.governance.has_rate_limiting ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Rate Limiting
        </span>
      </div>

      {/* Missing Controls Warning */}
      {topology.governance.missing_controls.length > 0 && (
        <div className="mx-5 my-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Missing Controls:</strong> {topology.governance.missing_controls.join(', ')}
          </div>
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
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.5}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="!shadow-lg !border !border-gray-200 !rounded-lg" />
          <Background color="#e5e7eb" gap={16} />
          <MiniMap
            className="!bg-white !border !border-gray-200 !rounded-lg !shadow-sm"
            nodeColor={(node) => {
              const colors = riskColors[node.data?.riskLevel] || riskColors.SAFE;
              return colors.border;
            }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-600 justify-center">
        {Object.entries(riskColors).map(([level, colors]) => (
          <div key={level} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors.bg, border: `2px solid ${colors.border}` }}
            />
            <span>{level}</span>
          </div>
        ))}
      </div>

      {/* Metadata */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-center">
        Framework: {topology.metadata.framework || 'Unknown'} | Nodes:{' '}
        {topology.metadata.node_count} | Edges: {topology.metadata.edge_count}
      </div>
    </div>
  );
}

export default TopologyMapVisualization;
