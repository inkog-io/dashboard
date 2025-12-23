'use client';

import { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { UserX, ShieldOff, Clock, FileX } from 'lucide-react';

export type MissingControlType = 'human_oversight' | 'authorization' | 'rate_limit' | 'audit_log';

export interface GhostNodeData {
  label: string;
  missingControl: MissingControlType;
  isGhost: true;
  onClick?: () => void;
}

const ghostIcons: Record<MissingControlType, React.ElementType> = {
  human_oversight: UserX,
  authorization: ShieldOff,
  rate_limit: Clock,
  audit_log: FileX,
};

const ghostLabels: Record<MissingControlType, string> = {
  human_oversight: 'Human Oversight',
  authorization: 'Authorization',
  rate_limit: 'Rate Limiting',
  audit_log: 'Audit Logging',
};

/**
 * GhostNode represents a missing governance control in the topology.
 * These nodes are synthetic - they don't exist in the actual code,
 * but visually show WHERE controls should be added.
 */
const GhostNode = memo(({ data }: NodeProps<GhostNodeData>) => {
  const Icon = ghostIcons[data.missingControl] || UserX;

  return (
    <div
      className="px-4 py-3 rounded-lg border-2 border-dashed border-red-400 bg-red-50/40 backdrop-blur-sm min-w-[160px] cursor-pointer hover:bg-red-50/60 transition-colors"
      onClick={data.onClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-red-400 !border-red-500 !w-2 !h-2"
      />

      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-red-100 rounded">
          <Icon className="h-4 w-4 text-red-600" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">
            Missing
          </span>
          <span className="text-sm font-medium text-red-700">
            {ghostLabels[data.missingControl] || data.label}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-red-400 !border-red-500 !w-2 !h-2"
      />
    </div>
  );
});

GhostNode.displayName = 'GhostNode';

export default GhostNode;
