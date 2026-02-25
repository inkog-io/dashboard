"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PROGRESS_LINES = [
  "> Cloning repository...",
  "> Analyzing project structure...",
  "> Detecting framework...",
  "> Building intermediate representation...",
  "> Mapping data flow vectors...",
  "> Running taint analysis...",
  "> Checking against OWASP Top 10 LLM...",
  "> Evaluating EU AI Act compliance...",
  "> Generating security report...",
];

interface TerminalProgressUIProps {
  isActive: boolean;
  repoName?: string;
  /** When true, fast-forward remaining lines at 200ms each */
  fastForward?: boolean;
}

export function TerminalProgressUI({
  isActive,
  repoName,
  fastForward,
}: TerminalProgressUIProps) {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track elapsed time for slow-scan warnings
  useEffect(() => {
    if (!isActive) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    setVisibleLines(0);
    let current = 0;

    function scheduleNext() {
      if (current >= PROGRESS_LINES.length) return;

      const delay = fastForward ? 200 : 1500 + Math.random() * 1000;
      timerRef.current = setTimeout(() => {
        current++;
        setVisibleLines(current);
        scheduleNext();
      }, delay);
    }

    scheduleNext();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, fastForward]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visibleLines]);

  if (!isActive) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden shadow-2xl">
        {/* Terminal title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 border-b border-gray-800">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="ml-2 text-xs text-gray-500 font-mono">
            inkog scan {repoName ? `— ${repoName}` : ""}
          </span>
        </div>

        {/* Terminal body */}
        <div
          ref={containerRef}
          className="p-6 font-mono text-sm text-green-400 min-h-[280px] max-h-[400px] overflow-y-auto"
        >
          <AnimatePresence>
            {PROGRESS_LINES.slice(0, visibleLines).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-1"
              >
                {line}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Blinking cursor on current line */}
          {visibleLines < PROGRESS_LINES.length && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-green-400">{">"}</span>
              <span className="animate-pulse text-green-300">▋</span>
            </div>
          )}

          {/* Slow-scan warnings */}
          {elapsedSeconds >= 60 && elapsedSeconds < 120 && visibleLines < PROGRESS_LINES.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-amber-400 text-xs"
            >
              {"> Scan is taking longer than expected for this repo size..."}
            </motion.div>
          )}
          {elapsedSeconds >= 120 && visibleLines < PROGRESS_LINES.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-amber-400 text-xs"
            >
              {"> Still working. Large repos can take up to 3 minutes."}
            </motion.div>
          )}

          {/* Completed indicator */}
          {visibleLines >= PROGRESS_LINES.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-3 text-green-300 font-semibold"
            >
              ✓ Scan complete. Loading report...
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
