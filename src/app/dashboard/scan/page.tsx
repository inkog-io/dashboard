"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Upload,
  FileCode,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  Terminal,
  ArrowRight,
  Plus,
  Bot,
  X,
  FileText,
  Server,
  FileArchive,
  Lock,
  Sparkles,
  HelpCircle,
} from "lucide-react";

import {
  createAPIClient,
  InkogAPIError,
  type Finding,
  type ScanResult,
  type InkogAPI,
} from "@/lib/api";
import { useApiKeyStatus } from "@/hooks/useApiKeyStatus";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  getFindingType,
  matchesFindingSearch,
  matchesFramework,
  frameworkDisplayNames,
} from "@/lib/finding-utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GovernanceScore } from "@/components/GovernanceScore";
import { TopologyMapVisualization } from "@/components/TopologyMap";
import { GroupedFindings } from "@/components/GroupedFindings";
import { FindingDetailsPanel } from "@/components/FindingDetailsPanel";
import { FindingsToolbar, type SeverityFilter, type TypeFilter } from "@/components/FindingsToolbar";
import { PolicySelector, type ScanPolicy, getStoredPolicy } from "@/components/PolicySelector";
import { cn } from "@/lib/utils";
import { addPendingDeepScan, removePendingDeepScan } from "@/lib/pending-deep-scans";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ScanMode = "agent" | "skill";

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        </div>
      }
    >
      <ScanPageContent />
    </Suspense>
  );
}

function ScanPageContent() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [api, setApi] = useState<InkogAPI | null>(null);
  const { hasKeys } = useApiKeyStatus();
  const { canAccessDeepScan } = useCurrentUser();

  // Mode state (URL-driven)
  const mode = (searchParams.get("mode") as ScanMode) || "agent";
  const setMode = useCallback(
    (m: ScanMode) => {
      router.push(`/dashboard/scan?mode=${m}`, { scroll: false });
    },
    [router]
  );

  // Agent scan state
  const [files, setFiles] = useState<File[]>([]);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scanPolicy, setScanPolicy] = useState<ScanPolicy>("balanced");
  const [agentName, setAgentName] = useState("");
  const [agentNameAutoDetected, setAgentNameAutoDetected] = useState(false);

  // Scan progress state
  const [scanPhase, setScanPhase] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);

  // Findings panel state
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState<string | null>(null);

  // Deep mode state (agent)
  const [deepMode, setDeepMode] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [deepStatus, setDeepStatus] = useState<'idle' | 'uploading' | 'processing'>('idle');
  const [deepScanId, setDeepScanId] = useState<string | null>(null);
  const deepPollRef = useRef<NodeJS.Timeout | null>(null);

  // Deep mode state (skill)
  const [skillDeepMode, setSkillDeepMode] = useState(false);

  // Skill scan state
  const [skillScanning, setSkillScanning] = useState(false);
  const [mcpServer, setMcpServer] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [skillError, setSkillError] = useState("");

  const popularServers = [
    { name: "filesystem", desc: "File system operations" },
    { name: "github", desc: "GitHub API access" },
    { name: "postgres", desc: "PostgreSQL database" },
    { name: "sqlite", desc: "SQLite database" },
    { name: "puppeteer", desc: "Browser automation" },
    { name: "brave-search", desc: "Web search" },
  ];

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Load stored policy preference
  useEffect(() => {
    setScanPolicy(getStoredPolicy());
  }, []);

  // Cleanup deep scan polling on unmount
  useEffect(() => {
    return () => { if (deepPollRef.current) clearInterval(deepPollRef.current); };
  }, []);

  // Scan phases for progress UI
  const SCAN_PHASES = [
    { id: 'preparing', label: 'Preparing files...' },
    { id: 'analyzing', label: 'Analyzing code structure...' },
    { id: 'detecting', label: 'Detecting vulnerabilities...' },
    { id: 'governance', label: 'Checking governance compliance...' },
    { id: 'finalizing', label: 'Generating report...' },
  ];

  // Auto-detect agent name from first uploaded file
  useEffect(() => {
    if (files.length > 0 && !agentName) {
      const firstName = files[0].name
        .replace(/\.(py|js|ts|jsx|tsx|go|java|rb|json|yaml|yml|md)$/i, '')
        .replace(/[_]/g, '-')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setAgentName(firstName);
      setAgentNameAutoDetected(true);
    }
  }, [files, agentName]);

  // Handle agent name change (clears auto-detect flag)
  const handleAgentNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAgentName(e.target.value);
    setAgentNameAutoDetected(false);
  }, []);

  // Check if AGENTS.md was uploaded (for governance manifest warning)
  const hasAgentsMD = useMemo(() => {
    return files.some(f => f.name.toLowerCase() === 'agents.md');
  }, [files]);

  // Compute type counts from findings using shared utility
  const typeCounts = useMemo(() => {
    if (!result?.findings) return { vulnerability: 0, governance: 0 };

    return result.findings.reduce(
      (acc, finding) => {
        const type = getFindingType(finding);
        if (type === "governance_violation") {
          acc.governance++;
        } else {
          acc.vulnerability++;
        }
        return acc;
      },
      { vulnerability: 0, governance: 0 }
    );
  }, [result?.findings]);

  // Filter findings based on type, severity, framework and search using shared utilities
  const filteredFindings = useMemo(() => {
    if (!result?.findings) return [];

    return result.findings.filter((finding) => {
      // Type filter using shared utility
      if (typeFilter !== "ALL") {
        const findingType = getFindingType(finding);
        if (typeFilter === "VULNERABILITY" && findingType !== "vulnerability") {
          return false;
        }
        if (typeFilter === "GOVERNANCE" && findingType !== "governance_violation") {
          return false;
        }
      }

      // Severity filter
      if (severityFilter !== "ALL" && finding.severity !== severityFilter) {
        return false;
      }

      // Framework filter (from clicking governance items)
      if (frameworkFilter) {
        if (!matchesFramework(finding, frameworkFilter)) {
          return false;
        }
      }

      // Search filter using shared utility (includes compliance fields)
      if (searchQuery) {
        if (!matchesFindingSearch(finding, searchQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [result?.findings, typeFilter, severityFilter, frameworkFilter, searchQuery]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const allowedExtensions = [
        "py",
        "js",
        "ts",
        "jsx",
        "tsx",
        "go",
        "java",
        "rb",
        "json",
        "yaml",
        "yml",
        "md",
      ];
      return allowedExtensions.includes(ext) || file.type.startsWith("text/");
    });

    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
      setError(null);
      setResult(null);
    }
  }, []);

  // Handle file input change
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) {
        setFiles((prev) => [...prev, ...selectedFiles]);
        setError(null);
        setResult(null);
      }
    },
    []
  );

  // Remove a file from the list
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    setResult(null);
    setError(null);
    setSeverityFilter("ALL");
    setTypeFilter("ALL");
    setSearchQuery("");
    setAgentName("");
    setAgentNameAutoDetected(false);
  }, []);

  // Demo examples for users to try
  const loadDemoExample = useCallback(() => {
    const demoCode = `# Demo AI Agent - Vulnerable Example
# This example contains intentional security issues for demonstration

import os
import openai
from langchain.agents import Tool, AgentExecutor

# VULNERABILITY: Hardcoded API credentials
OPENAI_API_KEY = "sk-proj-abc123xyz789secret"
DATABASE_PASSWORD = "admin123"

class CustomerSupportAgent:
    def __init__(self):
        # VULNERABILITY: Hardcoded credentials in code
        openai.api_key = OPENAI_API_KEY
        self.db_password = DATABASE_PASSWORD

    def process_user_input(self, user_message: str):
        # VULNERABILITY: Direct prompt injection risk
        # User input is directly concatenated into the prompt
        prompt = f"""You are a helpful assistant.

User request: {user_message}

Please help the user with their request."""

        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content

    def execute_query(self, query: str):
        # VULNERABILITY: SQL injection via LLM output
        # LLM-generated queries executed without validation
        import sqlite3
        conn = sqlite3.connect('customers.db')
        cursor = conn.cursor()
        cursor.execute(query)  # Unvalidated LLM output
        return cursor.fetchall()

    def run_dynamic_code(self, code_string: str):
        # VULNERABILITY: Unvalidated exec/eval
        exec(code_string)  # Arbitrary code execution

# VULNERABILITY: No rate limiting on API calls
def handle_request(request):
    agent = CustomerSupportAgent()
    return agent.process_user_input(request)

# VULNERABILITY: Recursive tool calling without depth limits
def recursive_tool(depth=0):
    if should_continue():
        return recursive_tool(depth + 1)  # No max depth
`;

    // Create a File object from the demo code
    const blob = new Blob([demoCode], { type: 'text/plain' });
    const demoFile = new File([blob], 'demo-vulnerable-agent.py', { type: 'text/plain' });

    setFiles([demoFile]);
    setAgentName('demo-vulnerable-agent');
    setAgentNameAutoDetected(true);
    setError(null);
    setResult(null);
  }, []);

  // Run the scan with progress UI
  const runScan = useCallback(async () => {
    if (!api || files.length === 0) return;

    setScanning(true);
    setError(null);
    setResult(null);
    setSelectedFinding(null);
    setSeverityFilter("ALL");
    setTypeFilter("ALL");
    setSearchQuery("");
    setFrameworkFilter(null);
    setScanProgress(0);
    setScanPhase(SCAN_PHASES[0].id);

    try {
      // Start progress animation
      let phaseIndex = 0;
      const phaseInterval = setInterval(() => {
        phaseIndex++;
        if (phaseIndex < SCAN_PHASES.length) {
          setScanPhase(SCAN_PHASES[phaseIndex].id);
          setScanProgress(Math.round((phaseIndex / SCAN_PHASES.length) * 100));
        }
      }, 500);

      // Run API call and minimum duration in parallel
      const [scanResult] = await Promise.all([
        api.scan.upload(files, scanPolicy, agentName || undefined),
        new Promise(resolve => setTimeout(resolve, 2700)) // Minimum 2.7s duration
      ]);

      clearInterval(phaseInterval);
      setScanProgress(100);
      setScanPhase(null);
      setResult(scanResult);
      // Use backend-resolved agent name if available
      if (scanResult.agent_name && scanResult.agent_name !== "unnamed-agent") {
        setAgentName(scanResult.agent_name);
      }
    } catch (err) {
      setScanPhase(null);
      setScanProgress(0);
      if (err instanceof InkogAPIError) {
        setError(`${err.message} (${err.code})`);
      } else {
        setError(err instanceof Error ? err.message : "Scan failed");
      }
    } finally {
      setScanning(false);
    }
  }, [api, files, scanPolicy, agentName, SCAN_PHASES]);

  // ZIP file handlers for deep mode
  const handleZipSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setZipFile(selected);
      if (!agentName) {
        setAgentName(selected.name.replace(/\.zip$/i, ''));
        setAgentNameAutoDetected(true);
      }
      setError(null);
    }
  }, [agentName]);

  const handleZipDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.zip') || dropped.type === 'application/zip')) {
      setZipFile(dropped);
      if (!agentName) {
        setAgentName(dropped.name.replace(/\.zip$/i, ''));
        setAgentNameAutoDetected(true);
      }
    } else {
      setError('Please upload a .zip file');
    }
  }, [agentName]);

  // Run deep scan (agent mode)
  const runDeepScan = useCallback(async () => {
    if (!api || !zipFile) return;
    setDeepStatus('uploading');
    setError(null);
    try {
      const data = await api.deepScan.trigger(zipFile, agentName || "Security Scan");
      setDeepScanId(data.scan_id);
      setDeepStatus('processing');
      addPendingDeepScan({
        scanId: data.scan_id,
        agentName: agentName || "Security Scan",
        startedAt: new Date().toISOString(),
      });
      deepPollRef.current = setInterval(async () => {
        try {
          const status = await api.deepScan.getStatus(data.scan_id);
          if (status.status === 'completed') {
            clearInterval(deepPollRef.current!);
            removePendingDeepScan(data.scan_id);
            router.push(`/dashboard/results/${data.scan_id}`);
          } else if (status.status === 'failed') {
            clearInterval(deepPollRef.current!);
            removePendingDeepScan(data.scan_id);
            setDeepStatus('idle');
            setError('Deep analysis failed. Please try again.');
          }
        } catch { /* ignore polling errors */ }
      }, 5000);
    } catch (err) {
      setDeepStatus('idle');
      setError(err instanceof Error ? err.message : 'Deep scan failed');
    }
  }, [api, zipFile, agentName, router]);

  // Skill scan handlers
  const handleMCPScan = useCallback(async () => {
    if (!api || !mcpServer.trim()) return;
    setSkillScanning(true);
    setSkillError("");

    try {
      const response = await api.skills.scanMCP(mcpServer.trim());
      if (response.scan_id) {
        router.push(`/dashboard/skills/${response.scan_id}${skillDeepMode ? '?deep=true' : ''}`);
      }
    } catch (err) {
      setSkillError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setSkillScanning(false);
    }
  }, [api, mcpServer, skillDeepMode, router]);

  const handleRepoScan = useCallback(async () => {
    if (!api || !repoUrl.trim()) return;
    setSkillScanning(true);
    setSkillError("");

    try {
      const response = await api.skills.scan({ repository_url: repoUrl.trim() });
      if (response.scan_id) {
        router.push(`/dashboard/skills/${response.scan_id}${skillDeepMode ? '?deep=true' : ''}`);
      }
    } catch (err) {
      setSkillError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setSkillScanning(false);
    }
  }, [api, repoUrl, skillDeepMode, router]);

  // Whether the mode selector should be hidden
  const hideModeSelector = scanning || !!result || deepStatus !== 'idle';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Security Scanner
          </h1>
          <p className="text-muted-foreground mt-1">
            Scan AI agents and skill packages for vulnerabilities and governance gaps.{" "}
            <a href="https://docs.inkog.io/frameworks" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground/60 hover:text-primary transition-colors">
              Supported frameworks &rarr;
            </a>
          </p>
        </div>
        {/* Deep Checks link removed — inline deep mode checkbox below */}
      </div>

      {/* Mode Selector Cards - Hidden during active scan or when results are displayed */}
      {!hideModeSelector && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode("agent")}
            className={cn(
              "relative rounded-xl border-2 p-4 text-left transition-all",
              mode === "agent"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:bg-accent/50"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {mode === "agent" && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
              <span className="font-medium text-sm text-foreground">Agent Scan</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 flex-shrink-0" />
              Upload agent source files
            </p>
          </button>

          <button
            onClick={() => setMode("skill")}
            className={cn(
              "relative rounded-xl border-2 p-4 text-left transition-all",
              mode === "skill"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:bg-accent/50"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {mode === "skill" && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
              <span className="font-medium text-sm text-foreground">Skill Scan</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 flex-shrink-0" />
              Scan MCP servers &amp; skill packages
            </p>
          </button>
        </div>
      )}

      {/* Deep Mode Toggle */}
      {!hideModeSelector && (
        <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-3 -mt-4">
          {/* Toggle switch */}
          {canAccessDeepScan ? (
            <button
              type="button"
              role="switch"
              aria-checked={mode === "agent" ? deepMode : skillDeepMode}
              onClick={() => {
                if (mode === "agent") {
                  const next = !deepMode;
                  setDeepMode(next);
                  if (next) { setFiles([]); } else { setZipFile(null); }
                } else {
                  setSkillDeepMode(!skillDeepMode);
                }
              }}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                (mode === "agent" ? deepMode : skillDeepMode)
                  ? "bg-violet-600"
                  : "bg-muted-foreground/25"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
                  (mode === "agent" ? deepMode : skillDeepMode) ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="https://inkog.io/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-muted-foreground/15 transition-colors hover:bg-violet-200 dark:hover:bg-violet-900/30 group"
                >
                  <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 translate-x-0">
                    <Lock className="h-3 w-3 text-muted-foreground absolute top-1 left-1" />
                  </span>
                </a>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                className="max-w-[240px] bg-popover text-popover-foreground border border-border shadow-lg p-3"
              >
                <p className="font-medium text-xs mb-1.5">Upgrade to unlock Deep Analysis</p>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  {mode === "agent" ? (
                    <>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Full codebase taint tracking</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Exploitability assessment</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Multi-agent flow analysis</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Remediation guidance per finding</li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>AI-powered code analysis</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Tool poisoning detection</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Supply chain risk assessment</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Permission scope analysis</li>
                    </>
                  )}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Label */}
          <div className="flex items-center gap-2">
            <Sparkles className={cn("h-4 w-4", canAccessDeepScan && (mode === "agent" ? deepMode : skillDeepMode) ? "text-violet-600" : "text-muted-foreground")} />
            <span className="text-sm font-medium text-foreground">Deep Analysis</span>
            {canAccessDeepScan ? (
              <span className="text-xs text-muted-foreground">
                {(mode === "agent" ? deepMode : skillDeepMode)
                  ? mode === "agent" ? "ZIP upload for comprehensive scan" : "AI-powered code analysis"
                  : "Standard scan"}
              </span>
            ) : (
              <a
                href="https://inkog.io/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
              >
                Upgrade &rarr;
              </a>
            )}

            {/* Info tooltip — always visible */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="max-w-[240px] bg-popover text-popover-foreground border border-border shadow-lg p-3"
              >
                <p className="font-medium text-xs mb-1.5">What is Deep Analysis?</p>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  {mode === "agent" ? (
                    <>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Full codebase taint tracking</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Exploitability assessment</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Multi-agent flow analysis</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Remediation guidance per finding</li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>AI-powered code analysis</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Tool poisoning detection</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Supply chain risk assessment</li>
                      <li className="flex items-start gap-1.5"><span className="text-violet-500 mt-px">&#x2022;</span>Permission scope analysis</li>
                    </>
                  )}
                </ul>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        </TooltipProvider>
      )}

      {/* ===== AGENT MODE ===== */}
      {mode === "agent" && (
        <>
          {/* Upload Section - Hidden when results exist */}
          {!result && (
            <>
              {/* Deep scan processing state */}
              {deepStatus !== 'idle' && (
                <div className="border rounded-xl p-12 text-center space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold">
                      {deepStatus === 'uploading' ? 'Uploading repository...' : 'Deep Analysis in Progress'}
                    </h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      {deepStatus === 'processing'
                        ? 'Inkog Deep is analyzing your code. This can take up to 10 minutes.'
                        : 'Sending your repository to the analysis server...'}
                    </p>
                  </div>
                  {deepScanId && <p className="text-xs text-muted-foreground font-mono">Scan ID: {deepScanId}</p>}
                </div>
              )}

              {/* Deep mode: ZIP upload */}
              {deepMode && deepStatus === 'idle' && (
                <>
                  {!zipFile ? (
                    <div
                      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                        isDragging
                          ? "border-foreground bg-muted"
                          : "border-border hover:border-border"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                      }}
                      onDrop={handleZipDrop}
                    >
                      <FileArchive className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        Drag & drop your repository .zip file here
                      </p>
                      <input
                        type="file"
                        accept=".zip"
                        onChange={handleZipSelect}
                        className="hidden"
                        id="zip-upload"
                      />
                      <label
                        htmlFor="zip-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 cursor-pointer transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Choose .zip file
                      </label>
                      <p className="text-xs text-muted-foreground mt-3">
                        Max 50MB. The entire repository folder should be zipped.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <FileArchive className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{zipFile.name}</p>
                            <p className="text-sm text-muted-foreground">{(zipFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button onClick={() => setZipFile(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-foreground mb-1.5">Agent Name</label>
                        <input
                          type="text"
                          placeholder="e.g., Sales Outreach Agent"
                          value={agentName}
                          onChange={handleAgentNameChange}
                          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <button
                        onClick={runDeepScan}
                        disabled={deepStatus !== 'idle'}
                        className="w-full py-3 bg-black dark:bg-white text-white dark:text-black font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Bot className="h-5 w-5" />
                        Run Deep Security Analysis
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Normal mode: Multi-file drop zone */}
              {!deepMode && deepStatus === 'idle' && files.length === 0 && (
                <div
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                    isDragging
                      ? "border-foreground bg-muted"
                      : "border-border hover:border-border"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                >
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Drag & drop your agent files here
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".py,.js,.ts,.jsx,.tsx,.go,.java,.rb,.json,.yaml,.yml,.md"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-input"
                  />
                  <div className="flex items-center gap-3 justify-center">
                    <label
                      htmlFor="file-input"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 cursor-pointer transition-colors"
                    >
                      Select Files
                    </label>
                    <button
                      onClick={loadDemoExample}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                    >
                      Try Demo
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Python, JavaScript, TypeScript, Go, Java, Ruby, JSON, YAML
                  </p>
                </div>
              )}

              {/* Selected Files (normal mode only) */}
              {!deepMode && files.length > 0 && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                  {/* Scanning Progress UI */}
                  {scanning ? (
                    <div className="py-4">
                      <div className="flex items-center gap-3 mb-4">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <span className="font-medium text-foreground">
                          Scanning {agentName || 'files'}...
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300 ease-out"
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>

                      {/* Phase Checklist */}
                      <div className="space-y-2">
                        {SCAN_PHASES.map((phase, idx) => {
                          const currentIdx = SCAN_PHASES.findIndex(p => p.id === scanPhase);
                          const isComplete = idx < currentIdx || (idx === currentIdx && scanProgress === 100);
                          const isCurrent = idx === currentIdx && scanProgress < 100;

                          return (
                            <div key={phase.id} className="flex items-center gap-2 text-sm">
                              {isComplete ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : isCurrent ? (
                                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border-2 border-border" />
                              )}
                              <span className={isComplete ? "text-muted-foreground" : isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}>
                                {phase.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Agent Name - At top, prominent */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          Agent Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., customer-support-bot"
                          value={agentName}
                          onChange={handleAgentNameChange}
                          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {agentNameAutoDetected && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Auto-detected from filename
                          </p>
                        )}
                      </div>

                      {/* File List */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-sm font-medium text-foreground">
                            Selected Files ({files.length})
                          </h3>
                          <button
                            onClick={clearFiles}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Clear all
                          </button>
                        </div>
                        <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                          {files.map((file, index) => (
                            <li
                              key={index}
                              className="flex items-center justify-between py-1.5 px-2.5 bg-muted rounded-lg text-sm"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileCode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-foreground truncate">{file.name}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  ({(file.size / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                              <button
                                onClick={() => removeFile(index)}
                                className="text-muted-foreground hover:text-red-500 ml-2 flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Add More Files Button */}
                      <div
                        className={`border-2 border-dashed rounded-lg py-2 text-center transition-colors cursor-pointer mb-4 ${
                          isDragging
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-border hover:border-border"
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                        }}
                        onDrop={handleDrop}
                      >
                        <input
                          type="file"
                          multiple
                          accept=".py,.js,.ts,.jsx,.tsx,.go,.java,.rb,.json,.yaml,.yml,.md"
                          onChange={handleFileInput}
                          className="hidden"
                          id="file-input-more"
                        />
                        <label
                          htmlFor="file-input-more"
                          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                          Add more files
                        </label>
                      </div>

                      {/* Policy Selector */}
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Scan Policy
                        </label>
                        <PolicySelector value={scanPolicy} onChange={setScanPolicy} />
                      </div>

                      {/* Start Scan Button */}
                      <button
                        onClick={runScan}
                        disabled={scanning}
                        className="w-full py-3 bg-black dark:bg-white text-white dark:text-black font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Shield className="h-5 w-5" />
                        Start Scan
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-6">
              {/* Agent Name Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {agentName || 'Scan Results'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {result.files_scanned} files scanned • {result.findings_count} findings • {result.scan_duration}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setResult(null);
                    setFiles([]);
                    setError(null);
                    setSelectedFinding(null);
                    setSeverityFilter("ALL");
                    setTypeFilter("ALL");
                    setAgentName("");
                    setSearchQuery("");
                    setFrameworkFilter(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  New Scan
                </button>
              </div>

              {/* Summary Stats */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-foreground">
                      {result.files_scanned}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase">Files Scanned</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-foreground">
                      {result.findings_count}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase">Total Findings</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">
                      {result.critical_count}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase">Critical</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">
                      {result.high_count}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase">High</p>
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground text-center">
                  Scanned {result.lines_of_code.toLocaleString()} lines of code in{" "}
                  {result.scan_duration || "0ms"}
                </div>
              </div>

              {/* CLI Setup CTA - Show to users without API keys */}
              {!hasKeys && (
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 text-white">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <Terminal className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Integrate with your workflow</h3>
                      <p className="text-sm text-white/70 mb-4">
                        Set up the CLI to scan on every commit, or add to your CI/CD pipeline for automated security checks.
                      </p>
                      <Link
                        href="/dashboard/onboarding"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
                      >
                        Set up CLI
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Governance Section */}
              {(result.governance_score !== undefined ||
                result.eu_ai_act_readiness) && (
                <ErrorBoundary>
                  <GovernanceScore
                    score={result.governance_score}
                    readiness={result.eu_ai_act_readiness}
                    articleMapping={result.article_mapping}
                    frameworkMapping={result.framework_mapping}
                    onFrameworkClick={(frameworkId) => {
                      // Set framework filter instead of search query
                      setFrameworkFilter(frameworkId);
                      setSearchQuery('');
                      document.getElementById('findings-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    onArticleClick={(article) => {
                      // For articles, search by the specific article name
                      setSearchQuery(article);
                      setFrameworkFilter(null);
                      document.getElementById('findings-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  />
                </ErrorBoundary>
              )}

              {/* Agent Topology Visualization */}
              {result.topology_map && (
                <ErrorBoundary
                  fallback={
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                      <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-amber-800 font-medium">
                        Topology visualization failed to load
                      </p>
                      <p className="text-sm text-amber-600 mt-1">
                        Your scan results are still available below.
                      </p>
                    </div>
                  }
                >
                  <TopologyMapVisualization
                    topology={result.topology_map}
                    findings={result.findings}
                    onFindingClick={(findingId) => {
                      const finding = result.findings.find((f) => f.id === findingId);
                      if (finding) {
                        setSelectedFinding(finding);
                      }
                    }}
                  />
                </ErrorBoundary>
              )}

              {/* Missing Governance Manifest Warning */}
              {!hasAgentsMD && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 flex items-start gap-3">
                  <FileText className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-indigo-800 dark:text-indigo-200">
                    <p className="font-medium">No Governance Manifest Found</p>
                    <p>
                      Add an <code className="bg-indigo-100 dark:bg-indigo-800/30 px-1 rounded">AGENTS.md</code> to your project root to enable governance
                      mismatch detection. This validates your declared capabilities against actual code behavior.
                    </p>
                    <a
                      href="https://docs.inkog.io/governance/agents-md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 underline mt-1 inline-block hover:text-indigo-800 dark:hover:text-indigo-300"
                    >
                      Learn about AGENTS.md →
                    </a>
                  </div>
                </div>
              )}

              {/* CLI Upsell Banner */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Terminal className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      Want full project scanning with governance validation?
                    </p>
                    <p className="text-sm text-muted-foreground">
                      The CLI scans entire directories, validates AGENTS.md constraints,
                      and integrates with CI/CD pipelines.
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/settings?tab=api-keys"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
                >
                  Get CLI Access
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Findings Section */}
              {result.findings.length > 0 ? (
                <div id="findings-section" className="bg-card rounded-xl border border-border shadow-sm overflow-hidden scroll-mt-4">
                  <div className="px-5 border-b border-border">
                    <FindingsToolbar
                      totalCount={result.findings_count}
                      criticalCount={result.critical_count}
                      highCount={result.high_count}
                      mediumCount={result.medium_count}
                      lowCount={result.low_count}
                      vulnerabilityCount={typeCounts.vulnerability}
                      governanceCount={typeCounts.governance}
                      selectedSeverity={severityFilter}
                      onSeverityChange={setSeverityFilter}
                      selectedType={typeFilter}
                      onTypeChange={setTypeFilter}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                    />
                  </div>

                  {/* Framework Filter Indicator */}
                  {frameworkFilter && (
                    <div className="px-5 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-700 dark:text-blue-300">
                          Filtered by: <strong>{frameworkDisplayNames[frameworkFilter] || frameworkFilter}</strong>
                        </span>
                        <button
                          onClick={() => setFrameworkFilter(null)}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                        >
                          Clear filter
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Findings List */}
                  {filteredFindings.length > 0 ? (
                    <GroupedFindings
                      findings={filteredFindings}
                      onFindingClick={(finding) => setSelectedFinding(finding)}
                    />
                  ) : (
                    <div className="px-5 py-8 text-center text-muted-foreground">
                      No findings match your filters
                    </div>
                  )}

                  {/* Results count */}
                  {filteredFindings.length > 0 && (
                    <div className="px-5 py-3 bg-muted border-t border-border text-xs text-muted-foreground">
                      Showing {filteredFindings.length} of {result.findings_count}{" "}
                      findings
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-medium text-green-800">
                    No vulnerabilities found!
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    Your code passed all security checks.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== SKILL MODE ===== */}
      {mode === "skill" && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {/* MCP Server Scan */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-5 w-5" />
                  Scan MCP Server
                </CardTitle>
                <CardDescription>
                  Scan an MCP server from the registry by name
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., github, filesystem"
                    value={mcpServer}
                    onChange={(e) => setMcpServer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleMCPScan()}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={skillScanning}
                  />
                  <button
                    onClick={handleMCPScan}
                    disabled={skillScanning || !mcpServer.trim()}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {skillScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
                  </button>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Popular servers:</p>
                  <div className="flex flex-wrap gap-1">
                    {popularServers.map((s) => (
                      <button
                        key={s.name}
                        onClick={() => setMcpServer(s.name)}
                        className="text-xs px-2 py-1 rounded-full border border-border hover:bg-accent"
                        title={s.desc}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Repository Scan */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCode className="h-5 w-5" />
                  Scan Repository
                </CardTitle>
                <CardDescription>
                  Scan a skill package from a GitHub repository URL
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://github.com/org/mcp-server"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRepoScan()}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={skillScanning}
                  />
                  <button
                    onClick={handleRepoScan}
                    disabled={skillScanning || !repoUrl.trim()}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {skillScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Skill Error */}
          {skillError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-400">{skillError}</p>
            </div>
          )}
        </>
      )}

      {/* Finding Details Panel (Slide-out) */}
      <FindingDetailsPanel
        finding={selectedFinding}
        open={!!selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
}
