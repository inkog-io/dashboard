"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Shield,
  Upload,
  Server,
  FileCode,
  Loader2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { createAPIClient, type SkillScanResponse } from "@/lib/api";

export default function SkillsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [mcpServer, setMcpServer] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SkillScanResponse | null>(null);

  const handleMCPScan = async () => {
    if (!mcpServer.trim()) return;
    setScanning(true);
    setError("");
    setResult(null);

    try {
      const token = await getToken();
      const api = createAPIClient(() => Promise.resolve(token));
      const response = await api.skills.scanMCP(mcpServer.trim());
      setResult(response);
      if (response.scan_id) {
        router.push(`/dashboard/skills/${response.scan_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleRepoScan = async () => {
    if (!repoUrl.trim()) return;
    setScanning(true);
    setError("");
    setResult(null);

    try {
      const token = await getToken();
      const api = createAPIClient(() => Promise.resolve(token));
      const response = await api.skills.scan({ repository_url: repoUrl.trim() });
      setResult(response);
      if (response.scan_id) {
        router.push(`/dashboard/skills/${response.scan_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const popularServers = [
    { name: "filesystem", desc: "File system operations" },
    { name: "github", desc: "GitHub API access" },
    { name: "postgres", desc: "PostgreSQL database" },
    { name: "sqlite", desc: "SQLite database" },
    { name: "puppeteer", desc: "Browser automation" },
    { name: "brave-search", desc: "Web search" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Skill Security Scanner
        </h1>
        <p className="text-muted-foreground mt-1">
          Scan MCP servers, SKILL.md packages, and agent tool definitions for vulnerabilities
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* MCP Server Scan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
                disabled={scanning}
              />
              <button
                onClick={handleMCPScan}
                disabled={scanning || !mcpServer.trim()}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
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
            <CardTitle className="flex items-center gap-2">
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
                disabled={scanning}
              />
              <button
                onClick={handleRepoScan}
                disabled={scanning || !repoUrl.trim()}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Result */}
      {result?.result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.result.overall_risk === "low" ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              Scan Complete: {result.result.name || "Unknown"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{result.result.security_score}</div>
                <div className="text-xs text-muted-foreground">Security Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">{result.result.critical_count}</div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-500">{result.result.high_count}</div>
                <div className="text-xs text-muted-foreground">High</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{result.result.findings.length}</div>
                <div className="text-xs text-muted-foreground">Total Findings</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">MCP Servers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Detect tool poisoning, missing auth, transport security issues, and input validation gaps in MCP server implementations.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">SKILL.md Packages</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Validate manifests, detect hidden scripts, analyze allowed-tools declarations, and find supply chain risks.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Agent Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Scan tool definitions in LangChain, CrewAI, and other frameworks for command injection, data exfiltration, and excessive permissions.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
