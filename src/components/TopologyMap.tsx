'use client';

import { useMemo } from 'react';
import { type TopologyMap, type TopologyNode, type TopologyEdge } from '@/lib/api';

interface TopologyMapProps {
  topology?: TopologyMap;
}

// Risk level colors
const riskColors: Record<string, string> = {
  SAFE: '#22c55e',     // green-500
  LOW: '#3b82f6',      // blue-500
  MEDIUM: '#f59e0b',   // amber-500
  HIGH: '#f97316',     // orange-500
  CRITICAL: '#ef4444', // red-500
};

// Node type icons (emoji fallback for simplicity)
const nodeIcons: Record<string, string> = {
  Loop: '\u{1F504}',
  LLMCall: '\u{1F916}',
  ToolCall: '\u{1F527}',
  SystemPrompt: '\u{1F4AC}',
  HumanApproval: '\u{1F464}',
  AuthorizationCheck: '\u{1F510}',
  RateLimitConfig: '\u{23F1}',
  AuditLog: '\u{1F4DD}',
  Delegation: '\u{1F517}',
  MemoryAccess: '\u{1F4BE}',
};

// Simple force-directed layout calculation
function calculateLayout(nodes: TopologyNode[], edges: TopologyEdge[], width: number, height: number) {
  const positions = new Map<string, { x: number; y: number }>();

  // Initial random positions (seeded by node id for consistency)
  nodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length;
    const radius = Math.min(width, height) * 0.3;
    positions.set(node.id, {
      x: width / 2 + radius * Math.cos(angle),
      y: height / 2 + radius * Math.sin(angle),
    });
  });

  // Simple force simulation (10 iterations)
  for (let iter = 0; iter < 50; iter++) {
    // Repulsion between all nodes
    nodes.forEach((node1) => {
      nodes.forEach((node2) => {
        if (node1.id === node2.id) return;

        const pos1 = positions.get(node1.id)!;
        const pos2 = positions.get(node2.id)!;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const repulsion = 1500 / (dist * dist);
        pos1.x -= (dx / dist) * repulsion;
        pos1.y -= (dy / dist) * repulsion;
      });
    });

    // Attraction along edges
    edges.forEach((edge) => {
      const pos1 = positions.get(edge.from);
      const pos2 = positions.get(edge.to);
      if (!pos1 || !pos2) return;

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const attraction = dist * 0.005;
      pos1.x += dx * attraction;
      pos1.y += dy * attraction;
      pos2.x -= dx * attraction;
      pos2.y -= dy * attraction;
    });

    // Center gravity
    nodes.forEach((node) => {
      const pos = positions.get(node.id)!;
      pos.x += (width / 2 - pos.x) * 0.01;
      pos.y += (height / 2 - pos.y) * 0.01;
    });

    // Boundary constraints
    nodes.forEach((node) => {
      const pos = positions.get(node.id)!;
      pos.x = Math.max(50, Math.min(width - 50, pos.x));
      pos.y = Math.max(50, Math.min(height - 50, pos.y));
    });
  }

  return positions;
}

/**
 * TopologyMap displays a visual representation of the agent's architecture.
 * Shows nodes (loops, LLM calls, tools) with risk-level coloring and
 * governance status indicators.
 */
export function TopologyMapVisualization({ topology }: TopologyMapProps) {
  const width = 600;
  const height = 400;

  // Calculate layout
  const positions = useMemo(() => {
    if (!topology || topology.nodes.length === 0) {
      return new Map<string, { x: number; y: number }>();
    }
    return calculateLayout(topology.nodes, topology.edges, width, height);
  }, [topology]);

  if (!topology || topology.nodes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Agent Topology</h3>
        <p className="text-gray-500 text-sm">No topology data available for this scan.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Agent Topology</h3>

      {/* Governance status summary */}
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <span className={`flex items-center gap-1 ${topology.governance.has_human_oversight ? 'text-green-600' : 'text-red-500'}`}>
          {topology.governance.has_human_oversight ? '\u2713' : '\u2717'} Human Oversight
        </span>
        <span className={`flex items-center gap-1 ${topology.governance.has_auth_checks ? 'text-green-600' : 'text-red-500'}`}>
          {topology.governance.has_auth_checks ? '\u2713' : '\u2717'} Authorization
        </span>
        <span className={`flex items-center gap-1 ${topology.governance.has_audit_logging ? 'text-green-600' : 'text-red-500'}`}>
          {topology.governance.has_audit_logging ? '\u2713' : '\u2717'} Audit Logging
        </span>
        <span className={`flex items-center gap-1 ${topology.governance.has_rate_limiting ? 'text-green-600' : 'text-red-500'}`}>
          {topology.governance.has_rate_limiting ? '\u2713' : '\u2717'} Rate Limiting
        </span>
      </div>

      {/* Missing controls warning */}
      {topology.governance.missing_controls.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Missing Controls:</strong> {topology.governance.missing_controls.join(', ')}
        </div>
      )}

      {/* SVG Visualization */}
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="mx-auto bg-gray-50 rounded-lg">
          {/* Defs for arrow markers */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Edges */}
          {topology.edges.map((edge, idx) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;

            // Calculate angle for arrow positioning
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const nodeRadius = 24;

            // Shorten the line to not overlap with nodes
            const startX = from.x + (dx / dist) * nodeRadius;
            const startY = from.y + (dy / dist) * nodeRadius;
            const endX = to.x - (dx / dist) * (nodeRadius + 5);
            const endY = to.y - (dy / dist) * (nodeRadius + 5);

            return (
              <g key={`edge-${idx}`}>
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="#94a3b8"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
                {edge.label && (
                  <text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748b"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {topology.nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;

            const color = riskColors[node.risk_level] || riskColors.LOW;
            const icon = nodeIcons[node.type] || '\u{1F4E6}';

            return (
              <g key={node.id} className="cursor-pointer" transform={`translate(${pos.x}, ${pos.y})`}>
                {/* Node circle */}
                <circle
                  r="24"
                  fill={color}
                  stroke="#fff"
                  strokeWidth="3"
                  className="drop-shadow-md"
                />
                {/* Icon */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="16"
                  fill="#fff"
                >
                  {icon}
                </text>
                {/* Label below */}
                <text
                  y="38"
                  textAnchor="middle"
                  fontSize="11"
                  fill="#374151"
                  className="font-medium"
                >
                  {node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label}
                </text>
                {/* Risk indicator badge */}
                {node.risk_reasons && node.risk_reasons.length > 0 && (
                  <g transform="translate(16, -16)">
                    <circle r="8" fill="#ef4444" stroke="#fff" strokeWidth="2" />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="9"
                      fill="#fff"
                      fontWeight="bold"
                    >
                      {node.risk_reasons.length}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-600 justify-center">
        {Object.entries(riskColors).map(([level, color]) => (
          <div key={level} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span>{level}</span>
          </div>
        ))}
      </div>

      {/* Metadata */}
      <div className="mt-4 pt-4 border-t text-xs text-gray-500 text-center">
        Framework: {topology.metadata.framework || 'Unknown'} |
        Nodes: {topology.metadata.node_count} |
        Edges: {topology.metadata.edge_count}
      </div>
    </div>
  );
}

export default TopologyMapVisualization;
