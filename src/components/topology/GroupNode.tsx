'use client';

import { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface GroupNodeData {
  label: string;
  type: string;
  riskLevel: string;
  riskReasons?: string[];
  location?: { file?: string; line?: number };
}

/**
 * GroupNode renders as a container box for loops that contain other nodes.
 * Uses ReactFlow's sub-flow feature where children have parentNode set.
 */
const GroupNode = memo(({ data }: NodeProps<GroupNodeData>) => {
  const isHighRisk = data.riskLevel === 'HIGH' || data.riskLevel === 'CRITICAL';

  // Risk-based styling
  const borderColor = isHighRisk ? 'border-orange-400' : 'border-amber-400';
  const bgColor = isHighRisk ? 'bg-orange-50/60' : 'bg-amber-50/60';
  const headerBg = isHighRisk ? 'bg-orange-100/70' : 'bg-amber-100/70';
  const headerBorder = isHighRisk ? 'border-orange-200' : 'border-amber-200';
  const textColor = isHighRisk ? 'text-orange-800' : 'text-amber-800';
  const iconColor = isHighRisk ? 'text-orange-600' : 'text-amber-600';

  return (
    <div
      className={`relative rounded-lg border-2 border-dashed ${borderColor} ${bgColor}`}
      style={{
        minWidth: 320,
        minHeight: 200,
        // Allow the group to expand to fit children
        padding: '0 0 16px 0',
      }}
    >
      {/* Header bar */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${headerBorder} ${headerBg} rounded-t-md`}>
        <RefreshCw className={`w-4 h-4 ${iconColor}`} />
        <span className={`text-sm font-medium ${textColor}`}>
          {data.label}
        </span>

        {/* Risk badge for weak termination etc */}
        {data.riskReasons && data.riskReasons.length > 0 && (
          <div className="ml-auto flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">
              {data.riskReasons[0]}
            </span>
          </div>
        )}
      </div>

      {/*
        Children with parentNode=this.id will render inside this container.
        ReactFlow handles positioning relative to the parent automatically.
      */}
      <div className="p-4">
        {/* Children rendered by ReactFlow inside here */}
      </div>

      {/* Handles for connections to/from the group */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-400 !border-amber-500 !w-3 !h-3 !-top-1.5"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-400 !border-amber-500 !w-3 !h-3 !-bottom-1.5"
      />
    </div>
  );
});

GroupNode.displayName = 'GroupNode';

export default GroupNode;
