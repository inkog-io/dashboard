"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyCommandProps {
  command: string;
  label?: string;
  onCopy?: () => void;
  className?: string;
}

export function CopyCommand({ command, label, onCopy, className }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
        <code className="flex-1 text-sm font-mono text-foreground break-all">
          {command}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={copied ? "Copied!" : "Copy to clipboard"}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
