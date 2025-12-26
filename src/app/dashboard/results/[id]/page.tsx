"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Calendar,
  FileCode,
  Clock,
  Bot,
} from "lucide-react";

import {
  createAPIClient,
  InkogAPIError,
  type Finding,
  type ScanFull,
  type InkogAPI,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GovernanceScore } from "@/components/GovernanceScore";
import { TopologyMapVisualization } from "@/components/TopologyMap";
import { FindingCard } from "@/components/FindingCard";
import { FindingDetailsPanel } from "@/components/FindingDetailsPanel";
import { FindingsToolbar, type SeverityFilter, type TypeFilter } from "@/components/FindingsToolbar";
import { StrengthsSection } from "@/components/dashboard/StrengthsSection";

export default function ScanResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const [api, setApi] = useState<InkogAPI | null>(null);

  const [scan, setScan] = useState<ScanFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Findings panel state
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Fetch scan data
  useEffect(() => {
    if (!api || !params.id) return;

    const fetchScan = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.scans.get(params.id as string);
        setScan(response.scan);
      } catch (err) {
        if (err instanceof InkogAPIError) {
          if (err.status === 404) {
            setError("Scan not found. It may have been deleted.");
          } else {
            setError(`${err.message} (${err.code})`);
          }
        } else {
          setError(err instanceof Error ? err.message : "Failed to load scan");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchScan();
  }, [api, params.id]);

  // Compute type counts from findings
  const typeCounts = useMemo(() => {
    if (!scan?.findings) return { vulnerability: 0, governance: 0 };

    return scan.findings.reduce(
      (acc, finding) => {
        const type = finding.finding_type ||
          (finding.pattern_id?.includes("missing_") ||
           finding.pattern_id?.includes("oversight") ||
           finding.pattern_id?.includes("rate_limit") ||
           finding.pattern_id?.includes("audit") ||
           finding.pattern_id?.includes("authorization")
            ? "governance_violation"
            : "vulnerability");

        if (type === "governance_violation") {
          acc.governance++;
        } else {
          acc.vulnerability++;
        }
        return acc;
      },
      { vulnerability: 0, governance: 0 }
    );
  }, [scan?.findings]);

  // Filter findings based on type, severity and search
  const filteredFindings = useMemo(() => {
    if (!scan?.findings) return [];

    return scan.findings.filter((finding) => {
      // Type filter
      if (typeFilter !== "ALL") {
        const findingType = finding.finding_type ||
          (finding.pattern_id?.includes("missing_") ||
           finding.pattern_id?.includes("oversight") ||
           finding.pattern_id?.includes("rate_limit") ||
           finding.pattern_id?.includes("audit") ||
           finding.pattern_id?.includes("authorization")
            ? "governance_violation"
            : "vulnerability");

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

      // Search filter (includes compliance mapping)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();

        // Check basic fields
        const matchesBasic =
          finding.message?.toLowerCase().includes(query) ||
          finding.pattern_id?.toLowerCase().includes(query) ||
          finding.file?.toLowerCase().includes(query) ||
          finding.cwe?.toLowerCase().includes(query) ||
          finding.owasp_category?.toLowerCase().includes(query);

        // Check compliance mappings (for framework/article filtering)
        const complianceMapping = finding.compliance_mapping;
        const matchesCompliance = complianceMapping && (
          complianceMapping.eu_ai_act_articles?.some(a => a.toLowerCase().includes(query)) ||
          complianceMapping.nist_categories?.some(c => c.toLowerCase().includes(query)) ||
          complianceMapping.iso_42001_clauses?.some(c => c.toLowerCase().includes(query)) ||
          complianceMapping.owasp_items?.some(i => i.toLowerCase().includes(query)) ||
          complianceMapping.cwe_ids?.some(c => c.toLowerCase().includes(query))
        );

        if (!matchesBasic && !matchesCompliance) return false;
      }

      return true;
    });
  }, [scan?.findings, typeFilter, severityFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-10 w-10 text-gray-400 animate-spin mb-4" />
        <p className="text-gray-500">Loading scan results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
            Failed to load scan
          </h2>
          <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={() => router.push("/dashboard/history")}>
              View History
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!scan) {
    return null;
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="h-9 px-3"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-gray-400" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {scan.agent_name || "Scan Results"}
              </h1>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                #{scan.scan_number}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(scan.created_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        <Button
          onClick={() => router.push(`/dashboard/scan?agent=${encodeURIComponent(scan.agent_name || "")}&path=${encodeURIComponent(scan.agent_path || "")}`)}
          className="h-9"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Rescan Agent
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {scan.files_scanned}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Files Scanned</p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {scan.findings_count}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total Findings</p>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {scan.critical_count}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Critical</p>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {scan.high_count}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">High</p>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {scan.governance_score}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Gov Score</p>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          Scanned {scan.lines_of_code.toLocaleString()} lines of code in {scan.duration_ms}ms
          {scan.scan_policy && (
            <span className="ml-2">
              &middot; Policy: <span className="capitalize">{scan.scan_policy}</span>
            </span>
          )}
        </div>
      </div>

      {/* Strengths Section */}
      {scan.strengths && scan.strengths.length > 0 && (
        <StrengthsSection strengths={scan.strengths} />
      )}

      {/* Governance Section */}
      {scan.governance_score !== undefined && (
        <ErrorBoundary>
          <GovernanceScore
            score={scan.governance_score}
            readiness="PARTIAL"
            onFrameworkClick={(frameworkId) => {
              setSearchQuery(frameworkId);
              document.getElementById('findings-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onArticleClick={(article) => {
              setSearchQuery(article);
              document.getElementById('findings-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </ErrorBoundary>
      )}

      {/* Agent Topology Visualization */}
      {scan.topology_map && (
        <ErrorBoundary
          fallback={
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-amber-800 dark:text-amber-200 font-medium">
                Topology visualization failed to load
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                Your scan results are still available below.
              </p>
            </div>
          }
        >
          <TopologyMapVisualization
            topology={scan.topology_map}
            findings={scan.findings}
            onFindingClick={(findingId) => {
              const finding = scan.findings.find((f) => f.id === findingId);
              if (finding) {
                setSelectedFinding(finding);
              }
            }}
          />
        </ErrorBoundary>
      )}

      {/* Findings Section */}
      {scan.findings && scan.findings.length > 0 ? (
        <div id="findings-section" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden scroll-mt-4">
          <div className="px-5 border-b border-gray-100 dark:border-gray-800">
            <FindingsToolbar
              totalCount={scan.findings_count}
              criticalCount={scan.critical_count}
              highCount={scan.high_count}
              mediumCount={scan.medium_count}
              lowCount={scan.low_count}
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

          {/* Findings List */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredFindings.length > 0 ? (
              filteredFindings.map((finding, index) => (
                <FindingCard
                  key={finding.id || index}
                  finding={finding}
                  onClick={() => setSelectedFinding(finding)}
                />
              ))
            ) : (
              <div className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                No findings match your filters
              </div>
            )}
          </div>

          {/* Results count */}
          {filteredFindings.length > 0 && (
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              Showing {filteredFindings.length} of {scan.findings_count} findings
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-lg font-medium text-green-800 dark:text-green-200">
            No vulnerabilities found!
          </p>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            Your code passed all security checks.
          </p>
        </div>
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
