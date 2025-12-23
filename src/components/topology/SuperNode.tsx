'use client';

import { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { Files, Bot, Wrench, MessageSquare, Database, Package } from 'lucide-react';

export interface MergedNodeInfo {
  id: string;
  label: string;
  location?: { file?: string; line?: number };
}

export interface SuperNodeData {
  label: string;
  type: string;
  mergedCount: number;
  mergedNodes: MergedNodeInfo[];
  riskLevel: string;
  onClick?: () => void;
}

// Type to icon mapping for supernodes
const typeIcons: Record<string, React.ElementType> = {
  SystemPrompt: MessageSquare,
  LLMCall: Bot,
  ToolCall: Wrench,
  MemoryAccess: Database,
  Default: Package,
};

// Risk level colors (matching main node colors)
const riskColors: Record<string, { bg: string; border: string; text: string }> = {
  SAFE: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  LOW: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  MEDIUM: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  HIGH: { bg: '#fed7aa', border: '#f97316', text: '#9a3412' },
  CRITICAL: { bg: '#fecaca', border: '#ef4444', text: '#991b1b' },
};

/**
 * SuperNode represents multiple merged nodes of the same type.
 * Shows a count badge and stacked icon to indicate consolidation.
 * Click to see details of all merged nodes in the sheet.
 */
const SuperNode = memo(({ data }: NodeProps<SuperNodeData>) => {
  const TypeIcon = typeIcons[data.type] || typeIcons.Default;
  const colors = riskColors[data.riskLevel] || riskColors.LOW;

  return (
    <div
      className="relative px-4 py-3 rounded-lg shadow-md border-2 min-w-[140px] cursor-pointer hover:shadow-lg transition-shadow"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
      onClick={data.onClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-2 !h-2"
      />

      <div className="flex items-center gap-2">
        {/* Stacked icon to indicate multiple items */}
        <div className="relative">
          <Files className="h-4 w-4" style={{ color: colors.text }} />
          <TypeIcon
            className="h-3 w-3 absolute -bottom-0.5 -right-0.5"
            style={{ color: colors.text }}
          />
        </div>

        <div className="flex flex-col">
          <span className="text-sm font-medium" style={{ color: colors.text }}>
            {data.label}
          </span>
        </div>
      </div>

      {/* Count badge */}
      <div
        className="absolute -top-2 -right-2 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow"
        style={{ backgroundColor: colors.border }}
      >
        {data.mergedCount}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400 !w-2 !h-2"
      />
    </div>
  );
});

SuperNode.displayName = 'SuperNode';

export default SuperNode;
