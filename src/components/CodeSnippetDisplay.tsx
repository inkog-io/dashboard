"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeSnippetDisplayProps {
  code: string;
  file: string;
  highlightLine?: number;
}

// Map file extensions to Prism language identifiers
function getLanguage(file: string): string {
  const ext = file.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    py: "python",
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    go: "go",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    rb: "ruby",
    java: "java",
    rs: "rust",
  };
  return langMap[ext] || "text";
}

export function CodeSnippetDisplay({ code, file, highlightLine }: CodeSnippetDisplayProps) {
  const language = getLanguage(file);

  // Parse the code snippet to extract line numbers
  // Expected format: "  68│  line content\n  69│→ line content"
  // The → marker indicates the finding line (stripped from display, used for highlighting)
  const lines = code.split("\n");
  const parsedLines: { lineNumber: number | null; content: string; isMarked: boolean }[] = [];

  for (const line of lines) {
    // Try to extract line number from format like "  68│" or "  68|"
    // The → arrow after │ marks the finding line
    const match = line.match(/^\s*(\d+)\s*[│|](→?)\s?(.*)$/);
    if (match) {
      const isMarked = match[2] === "→";
      let content = match[3];
      // If this is a marked line, add a leading space to match normal line indentation
      if (isMarked && content.length > 0) {
        content = " " + content;
      }
      parsedLines.push({
        lineNumber: parseInt(match[1], 10),
        content,
        isMarked,
      });
    } else {
      // No line number format, use raw content
      parsedLines.push({
        lineNumber: null,
        content: line,
        isMarked: false,
      });
    }
  }

  // Auto-detect highlight line from → marker if not provided via prop
  const effectiveHighlightLine = highlightLine ?? parsedLines.find((l) => l.isMarked)?.lineNumber;

  // Determine if we have line numbers in the snippet
  const hasLineNumbers = parsedLines.some((l) => l.lineNumber !== null);

  // Compute dynamic widths based on line number magnitude
  const maxLineNum = Math.max(...parsedLines.map(l => l.lineNumber ?? 0));
  const lineNumWidth = maxLineNum >= 1000 ? 'w-16' : maxLineNum >= 100 ? 'w-14' : 'w-12';
  const codePadding = maxLineNum >= 1000 ? 'pl-[4.5rem]' : maxLineNum >= 100 ? 'pl-16' : 'pl-14';

  // If no line numbers in snippet, just use raw code
  if (!hasLineNumbers) {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <SyntaxHighlighter
          language={language}
          style={oneLight}
          customStyle={{
            margin: 0,
            padding: "1rem",
            fontSize: "0.8125rem",
            lineHeight: "1.5",
            background: "transparent",
          }}
          codeTagProps={{
            style: {
              fontFamily: "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }

  // Custom rendering with line numbers and highlighting
  const cleanCode = parsedLines.map((l) => l.content).join("\n");

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="relative">
        {/* Line numbers column */}
        <div className={`absolute left-0 top-0 bottom-0 ${lineNumWidth} bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col py-4 text-right pr-3 select-none`}>
          {parsedLines.map((line, idx) => {
            const isHighlighted = effectiveHighlightLine && line.lineNumber === effectiveHighlightLine;
            return (
              <span
                key={idx}
                className={`text-xs leading-6 font-mono ${
                  isHighlighted ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-400"
                }`}
              >
                {line.lineNumber ?? ""}
              </span>
            );
          })}
        </div>

        {/* Code content */}
        <div className={codePadding}>
          {parsedLines.map((line, idx) => {
            const isHighlighted = effectiveHighlightLine && line.lineNumber === effectiveHighlightLine;
            return (
              <div
                key={idx}
                className={`${
                  isHighlighted
                    ? "bg-red-50 dark:bg-red-900/30 border-l-2 border-red-400 dark:border-red-500 -ml-2 pl-2"
                    : ""
                }`}
              >
                <SyntaxHighlighter
                  language={language}
                  style={oneLight}
                  customStyle={{
                    margin: 0,
                    padding: 0,
                    paddingTop: idx === 0 ? "1rem" : 0,
                    paddingBottom: idx === parsedLines.length - 1 ? "1rem" : 0,
                    fontSize: "0.8125rem",
                    lineHeight: "1.5",
                    background: "transparent",
                  }}
                  codeTagProps={{
                    style: {
                      fontFamily: "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
                    },
                  }}
                  PreTag="div"
                >
                  {line.content || " "}
                </SyntaxHighlighter>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
