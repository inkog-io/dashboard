/**
 * API Client for Inkog Dashboard
 *
 * Automatically handles authentication by injecting Clerk session tokens
 * into all requests to the backend API.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.inkog.io';

/**
 * Type definitions for API responses
 */
export interface APIKey {
  id: string;
  user_id: string;
  org_id: string | null;
  key_prefix: string;
  name: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

// =============================================================================
// Organization Types
// =============================================================================

/** User's role within an organization */
export type OrgRole = 'owner' | 'admin' | 'member';

/** Organization with user's membership info */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
  member_count: number;
  created_at: string;
  updated_at?: string;
}

/** Organization member with user details */
export interface OrgMember {
  user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: OrgRole;
  joined_at: string;
}

/** Organization statistics */
export interface OrgStats {
  total_scans: number;
  unique_agents: number;
  findings: {
    total: number;
    by_severity: Record<string, number>;
    by_category: Record<string, number>;
  };
  risk_score: {
    average: number;
    trend: number;
    trend_direction: 'improving' | 'stable' | 'degrading';
  };
  scan_frequency: {
    daily_average: number;
    weekly_total: number;
  };
  last_scan_at: string | null;
}

/** Response for listing organizations */
export interface OrganizationsListResponse {
  organizations: Organization[];
}

/** Response for organization members */
export interface OrgMembersResponse {
  members: OrgMember[];
  total: number;
}

/** Response for organization stats */
export interface OrgStatsResponse {
  success: boolean;
  stats: OrgStats;
}

// =============================================================================
// Suppression Types
// =============================================================================

/** Reason for suppressing a finding */
export type SuppressionReason = 'false_positive' | 'accepted_risk' | 'wont_fix' | 'mitigated';

/** A suppressed finding */
export interface Suppression {
  id: string;
  pattern_id: string;
  pattern_title?: string;
  pattern_severity?: string;
  agent_id: string | null;
  agent_name?: string | null;
  file_path: string | null;
  line_number: number | null;
  finding_hash: string | null;
  reason: SuppressionReason;
  justification: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by: {
    id: string;
    email: string;
    name?: string;
  };
  updated_at: string;
  revoked_at: string | null;
  revoked_by: {
    id: string;
    email: string;
  } | null;
}

/** Request to create a suppression */
export interface CreateSuppressionRequest {
  pattern_id: string;
  agent_id?: string;
  file_path?: string;
  line_number?: number;
  finding_hash?: string;
  reason: SuppressionReason;
  justification?: string;
  expires_at?: string;
}

/** Response for listing suppressions */
export interface SuppressionsListResponse {
  suppressions: Suppression[];
  total: number;
  has_more: boolean;
}

/** Response for creating a suppression */
export interface CreateSuppressionResponse {
  success: boolean;
  suppression: Suppression;
}

/** Response for checking if a finding is suppressed */
export interface SuppressionCheckResponse {
  is_suppressed: boolean;
  suppression: Suppression | null;
}

/** Suppression statistics */
export interface SuppressionStats {
  total_active: number;
  total_expired: number;
  total_revoked: number;
  by_reason: Record<SuppressionReason, number>;
  by_pattern: Record<string, number>;
  expiring_soon: number;
  expiring_soon_threshold_days: number;
}

export interface CreateKeyResponse {
  success: boolean;
  key: string;  // Raw key - only shown once!
  api_key: APIKey;
}

export interface ListKeysResponse {
  success: boolean;
  api_keys: APIKey[];
  count: number;
}

export interface RevokeKeyResponse {
  success: boolean;
  message: string;
}

export interface Scan {
  id: string;
  user_id: string;
  org_id: string | null;
  api_key_id: string | null;
  agent_id?: string | null;
  agent_name?: string | null;      // Allow null for old scans
  agent_path?: string | null;      // Allow null for old scans
  scan_policy?: string | null;     // Allow null for old scans
  scan_number?: number | null;     // Allow null for old scans
  files_scanned: number;
  lines_of_code: number;
  findings_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  risk_score: number;
  governance_score?: number | null; // Allow null for old scans
  duration_ms: number;
  request_id: string;
  client_ip: string;
  user_agent: string;
  created_at: string;
}

export interface ScanSummary {
  total_scans: number;
  total_files_scanned: number;
  total_findings: number;
  average_risk_score: number;
  last_scan_at: string | null;
}

/** Agent represents a named agent for agent-centric dashboard */
export interface Agent {
  id: string;
  user_id: string;
  name: string;
  path: string;
  last_scan_id: string | null;
  last_scan_at: string | null;
  total_scans: number;
  health_status: 'unknown' | 'healthy' | 'warning' | 'critical';
  created_at: string;
  updated_at: string;
}

/** Strength represents a positive governance finding (good practice detected) */
export interface Strength {
  id: string;
  pattern_id: string;
  control_type: 'oversight' | 'authorization' | 'audit' | 'rate_limit';
  title: string;
  message: string;
}

/** Extended Scan with full data (findings, topology, strengths) */
export interface ScanFull extends Scan {
  agent_id: string | null;
  agent_name: string;
  agent_path: string;
  scan_policy: string;
  scan_number: number;
  governance_score: number;
  findings: Finding[];
  topology_map: TopologyMap | null;
  strengths: Strength[];
  // Governance compliance mappings
  eu_ai_act_readiness?: string;
  article_mapping?: Record<string, ArticleStatus>;
  framework_mapping?: Record<string, FrameworkStatus>;
}

export interface HistoryResponse {
  success: boolean;
  scans: Scan[];
  summary?: ScanSummary;
  count: number;
}

/** Pagination metadata for paginated responses */
export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

/** Paginated history response from new enterprise API */
export interface PaginatedHistoryResponse {
  success: boolean;
  scans: Scan[];
  summary?: ScanSummary;
  pagination: PaginationMeta;
}

/** Parameters for paginated history queries */
export interface HistoryParams {
  page?: number;
  page_size?: number;
  sort_by?: 'date' | 'risk_score' | 'findings_count';
  sort_order?: 'asc' | 'desc';
  date_from?: string;  // YYYY-MM-DD
  date_to?: string;    // YYYY-MM-DD
  severity?: 'critical' | 'high' | 'medium' | 'low';
  search?: string;
  summary?: boolean;
}

export interface DashboardStats {
  // Basic stats (backwards compatible)
  api_key_count: number;
  scans_today: number;
  total_findings: number;
  last_scan_at: string | null;

  // Security-focused metrics
  risk_score_avg: number;       // 7-day rolling average
  critical_unresolved: number;  // From latest scan
  high_unresolved: number;      // From latest scan
  governance_score_avg: number; // Derived from findings
  eu_ai_act_readiness: 'READY' | 'PARTIAL' | 'NOT_READY';

  // Trends
  scans_this_week: number;
  findings_trend: number[];     // Last 7 days counts
}

/**
 * Compliance mapping for findings (EU AI Act, NIST, OWASP, etc.)
 */
export interface ComplianceMapping {
  eu_ai_act_articles?: string[];
  nist_categories?: string[];
  iso_42001_clauses?: string[];
  owasp_items?: string[];
  gdpr_articles?: string[];
  cwe_ids?: string[];
  owasp_agentic?: string[];  // OWASP Agentic Security Initiative (T1-T7)
}

/**
 * Article status for EU AI Act compliance reporting
 */
export interface ArticleStatus {
  article: string;
  status: 'PASS' | 'PARTIAL' | 'FAIL';
  finding_count: number;
  description: string;
}

/**
 * Framework status for compliance framework reporting
 */
export interface FrameworkStatus {
  framework: string;
  status: 'PASS' | 'PARTIAL' | 'FAIL';
  finding_count: number;
}

/**
 * Topology Map types for agent visualization
 */
export interface TopologyMetadata {
  framework: string;
  file_path: string;
  input_type: string;
  node_count: number;
  edge_count: number;
}

export interface TopologyNodeLocation {
  file?: string;
  line?: number;
  column?: number;
}

export interface TopologyNode {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
  location?: TopologyNodeLocation;
  risk_level: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_reasons?: string[];
}

export interface TopologyEdge {
  from: string;
  to: string;
  type: string;
  label?: string;
}

export interface GovernanceStatus {
  has_human_oversight: boolean;
  has_auth_checks: boolean;
  has_audit_logging: boolean;
  has_rate_limiting: boolean;
  missing_controls: string[];
}

export interface TopologyMap {
  metadata: TopologyMetadata;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  governance: GovernanceStatus;
}

export type FindingType = 'vulnerability' | 'governance_violation';

// =============================================================================
// Diff Types - For comparing scans to show new/fixed findings
// =============================================================================

/** Summary of finding for diff comparison */
export interface DiffFinding {
  id: string;
  pattern_id: string;
  file: string;
  line: number;
  column: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  confidence: number;
  category: string;
  owasp_category?: string;
}

/** Summary statistics for a diff */
export interface DiffSummary {
  total_new: number;
  total_fixed: number;
  total_unchanged: number;
  new_by_severity: Record<string, number>;
  fixed_by_severity: Record<string, number>;
  base_risk_score: number;
  head_risk_score: number;
  risk_delta: number;
}

/** Full diff result comparing two scans */
export interface DiffResult {
  base_scan_id: string;
  base_scan_time: string;
  head_scan_id: string;
  head_scan_time: string;
  summary: DiffSummary;
  new_findings: DiffFinding[];
  fixed_findings: DiffFinding[];
  unchanged_findings: DiffFinding[];
}

/** Response from the diff API endpoint */
export interface DiffResponse {
  success: boolean;
  diff?: DiffResult;
  error?: string;
}

export interface Finding {
  id: string;
  pattern_id: string;
  pattern: string;
  file: string;
  line: number;
  column: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  cwe: string;
  owasp_category?: string;
  message: string;
  category: string;
  risk_tier: 'vulnerability' | 'risk_pattern' | 'hardening';
  finding_type?: FindingType;  // vulnerability vs governance_violation
  input_tainted: boolean;
  taint_source: string;
  code_snippet?: string;
  // Topology linkage
  topology_node_id?: string;  // Explicit link to topology node for precise matching
  // Governance fields (EU AI Act compliance)
  governance_category?: 'oversight' | 'authorization' | 'audit' | 'privacy' | 'governance_mismatch';
  compliance_mapping?: ComplianceMapping;
  // CVE and External References (Phase 3 Enhancement)
  cve_references?: string[];
  owasp_agentic_threat?: string;  // e.g., "T1", "T3"
  palo_alto_threat?: string;       // e.g., "1" through "7"
  mitre_attack?: string[];         // e.g., ["T1059", "T1552.001"]
  // Calibration fields (self-learning confidence)
  calibrated_confidence?: number;
  calibration_reliability?: 'insufficient' | 'low' | 'moderate' | 'high' | 'very_high';
  calibration_samples?: number;
}

/**
 * Backend ScanResult - matches pkg/contract/contract.go ScanResult struct exactly
 * This is the raw response from the backend API
 */
export interface BackendScanResult {
  // Metadata
  contract_version: string;
  server_version: string;
  agent_name?: string;

  // Statistics
  risk_score: number;
  findings_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;

  // Results
  findings: Finding[];

  // Scan Details
  scan_duration: string;
  files_scanned: number;
  lines_of_code: number;
  patterns_checked: number;
  skipped_files: number;
  failed_files_count: number;
  failed_files: string[];
  panicked_detectors: string[];

  // Governance fields (EU AI Act compliance)
  governance_score: number;
  eu_ai_act_readiness: string;
  article_mapping?: Record<string, ArticleStatus>;
  framework_mapping?: Record<string, FrameworkStatus>;

  // Agent topology visualization
  topology_map?: TopologyMap;
}

/**
 * Backend ScanResponse - matches pkg/contract/contract.go ScanResponse struct exactly
 * This wraps ScanResult with metadata
 */
export interface BackendScanResponse {
  contract_version: string;
  server_version: string;
  scan_result: BackendScanResult;
  success: boolean;
  error?: string;
}

/**
 * EU AI Act readiness status
 */
export type EUAIActReadiness = 'READY' | 'PARTIAL' | 'NOT_READY';

/**
 * Export format types
 */
export interface ExportMetadata {
  tool: string;
  version: string;
  exported_at: string;
  scan_id: string;
  agent_name?: string;
  agent_path?: string;
  scan_number?: number;
}

export interface ExportSummary {
  files_scanned: number;
  lines_of_code: number;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  risk_score: number;
  governance_score: number;
  eu_ai_act_readiness: string;
  duration_ms: number;
  scan_policy?: string;
}

export interface FrameworkCompliance {
  name: string;
  status: 'PASS' | 'PARTIAL' | 'FAIL';
  finding_count: number;
  items?: string[];
}

export interface ExportComplianceReport {
  eu_ai_act?: FrameworkCompliance;
  nist_ai_rmf?: FrameworkCompliance;
  owasp_llm_top_10?: FrameworkCompliance;
  iso_42001?: FrameworkCompliance;
}

export interface ExportData {
  metadata: ExportMetadata;
  summary: ExportSummary;
  compliance: ExportComplianceReport;
  findings: Finding[];
  strengths?: Strength[];
}

/**
 * SARIF v2.1.0 types for export
 */
export interface SARIFMessage {
  text: string;
}

export interface SARIFConfiguration {
  level: string;
}

export interface SARIFRuleProperties {
  tags?: string[];
  'security-severity'?: string;
}

export interface SARIFRule {
  id: string;
  name: string;
  shortDescription: SARIFMessage;
  fullDescription?: SARIFMessage;
  helpUri?: string;
  defaultConfiguration: SARIFConfiguration;
  properties?: SARIFRuleProperties;
}

export interface SARIFDriver {
  name: string;
  version: string;
  informationUri: string;
  semanticVersion: string;
  rules: SARIFRule[];
}

export interface SARIFTool {
  driver: SARIFDriver;
}

export interface SARIFRegion {
  startLine: number;
  startColumn?: number;
}

export interface SARIFArtifact {
  uri: string;
}

export interface SARIFPhysicalLocation {
  artifactLocation: SARIFArtifact;
  region: SARIFRegion;
}

export interface SARIFLocation {
  physicalLocation: SARIFPhysicalLocation;
}

export interface SARIFResult {
  ruleId: string;
  level: string;
  message: SARIFMessage;
  locations: SARIFLocation[];
}

export interface SARIFRun {
  tool: SARIFTool;
  results: SARIFResult[];
}

export interface SARIFReport {
  $schema: string;
  version: string;
  runs: SARIFRun[];
}

/**
 * Frontend ScanResult - normalized format for UI components
 * This is what components receive after transformation
 */
export interface ScanResult {
  success: boolean;
  error?: string;
  agent_name?: string;

  // Statistics
  files_scanned: number;
  lines_of_code: number;
  findings_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  risk_score: number;
  scan_duration: string;

  // Results
  findings: Finding[];

  // Governance fields
  governance_score: number;
  eu_ai_act_readiness: EUAIActReadiness;
  article_mapping?: Record<string, ArticleStatus>;
  framework_mapping?: Record<string, FrameworkStatus>;

  // Agent topology visualization
  topology_map?: TopologyMap;
}

/**
 * Safely converts backend readiness string to typed enum
 */
function toEUAIActReadiness(value: string | undefined): EUAIActReadiness {
  const validValues: EUAIActReadiness[] = ['READY', 'PARTIAL', 'NOT_READY'];
  if (value && validValues.includes(value as EUAIActReadiness)) {
    return value as EUAIActReadiness;
  }
  return 'NOT_READY';
}

/**
 * Transforms backend response to frontend format with defensive defaults
 */
function transformScanResponse(response: BackendScanResponse): ScanResult {
  const result = response.scan_result || {} as Partial<BackendScanResult>;

  return {
    success: response.success ?? false,
    error: response.error,
    agent_name: result.agent_name,

    // Statistics with defensive defaults
    files_scanned: result.files_scanned ?? 0,
    lines_of_code: result.lines_of_code ?? 0,
    findings_count: result.findings_count ?? 0,
    critical_count: result.critical_count ?? 0,
    high_count: result.high_count ?? 0,
    medium_count: result.medium_count ?? 0,
    low_count: result.low_count ?? 0,
    risk_score: result.risk_score ?? 0,
    scan_duration: result.scan_duration ?? '0ms',

    // Results
    findings: result.findings ?? [],

    // Governance
    governance_score: result.governance_score ?? 0,
    eu_ai_act_readiness: toEUAIActReadiness(result.eu_ai_act_readiness),
    article_mapping: result.article_mapping,
    framework_mapping: result.framework_mapping,

    // Topology
    topology_map: result.topology_map,
  };
}

export interface StatsResponse {
  success: boolean;
  stats: DashboardStats;
}

/** Response for listing agents */
export interface AgentsListResponse {
  success: boolean;
  agents: Agent[];
  count: number;
}

/** Response for single agent */
export interface AgentDetailResponse {
  success: boolean;
  agent: Agent;
}

/** Response for single scan with full data */
export interface ScanDetailResponse {
  success: boolean;
  scan: ScanFull;
}

/**
 * API Error response from backend (RFC 7807 Problem Details)
 */
export interface APIError {
  status: number;
  code: string;
  message: string;           // Backend sends 'message', not 'error'
  request_id?: string;
  details?: Record<string, unknown>;
  retry_after_seconds?: number;
  // Legacy field for backwards compatibility
  error?: string;
}

/**
 * Custom error class for API errors
 */
export class InkogAPIError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'InkogAPIError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Configuration for retry behavior
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  timeoutMs: 30000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

/**
 * Fetch with retry logic and timeout
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = RETRY_CONFIG.maxRetries,
  timeoutMs: number = RETRY_CONFIG.timeoutMs
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Don't retry on success or non-retryable errors
      if (response.ok || !RETRY_CONFIG.retryableStatuses.includes(response.status)) {
        return response;
      }

      // Retryable error - store and continue
      lastError = new Error(`HTTP ${response.status}`);

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on abort (except timeout which we handle differently)
      if (error instanceof DOMException && error.name === 'AbortError') {
        // This was a timeout - we can retry
      } else if (error instanceof TypeError) {
        // Network error - we can retry
      } else {
        throw error; // Unknown error - don't retry
      }
    }

    // Wait before retry (if not last attempt)
    if (attempt < retries) {
      await sleep(getBackoffDelay(attempt));
    }
  }

  // All retries exhausted
  throw lastError || new Error('Request failed after retries');
}

/**
 * Creates an authenticated API client using Clerk session tokens.
 *
 * @param getToken - Function to get the current Clerk session token
 * @returns API client with authenticated methods
 */
export function createAPIClient(getToken: () => Promise<string | null>) {
  /**
   * Makes an authenticated request to the API
   */
  async function request<T>(
    endpoint: string,
    options: RequestInit = {},
    requestTimeoutMs?: number
  ): Promise<T> {
    const token = await getToken();

    if (!token) {
      throw new InkogAPIError('Not authenticated', 'not_authenticated', 401);
    }

    const response = await fetchWithRetry(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    }, RETRY_CONFIG.maxRetries, requestTimeoutMs || RETRY_CONFIG.timeoutMs);

    const data = await response.json();

    if (!response.ok) {
      const error = data as APIError;
      throw new InkogAPIError(
        error.message || error.error || 'Request failed',
        error.code || 'unknown_error',
        response.status
      );
    }

    return data as T;
  }

  return {
    /**
     * API Key Management
     */
    keys: {
      /**
       * List all API keys for the current user
       */
      list: () => request<ListKeysResponse>('/v1/keys'),

      /**
       * Create a new API key
       */
      create: (name?: string, scopes?: string[]) =>
        request<CreateKeyResponse>('/v1/keys', {
          method: 'POST',
          body: JSON.stringify({ name, scopes }),
        }),

      /**
       * Revoke an API key
       */
      revoke: (keyId: string) =>
        request<RevokeKeyResponse>(`/v1/keys/${keyId}`, {
          method: 'DELETE',
        }),
    },

    /**
     * Scan History
     */
    history: {
      /**
       * Get scan history for the current user (legacy mode)
       */
      list: (options?: { limit?: number; summary?: boolean }) => {
        const params = new URLSearchParams();
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.summary) params.set('summary', 'true');
        const query = params.toString();
        return request<HistoryResponse>(`/v1/history${query ? `?${query}` : ''}`);
      },

      /**
       * Get paginated scan history with filtering and sorting (enterprise mode)
       */
      listPaginated: (options?: HistoryParams) => {
        const params = new URLSearchParams();
        if (options?.page) params.set('page', options.page.toString());
        if (options?.page_size) params.set('page_size', options.page_size.toString());
        if (options?.sort_by) params.set('sort_by', options.sort_by);
        if (options?.sort_order) params.set('sort_order', options.sort_order);
        if (options?.date_from) params.set('date_from', options.date_from);
        if (options?.date_to) params.set('date_to', options.date_to);
        if (options?.severity) params.set('severity', options.severity);
        if (options?.search) params.set('search', options.search);
        if (options?.summary) params.set('summary', 'true');
        const query = params.toString();
        return request<PaginatedHistoryResponse>(`/v1/history${query ? `?${query}` : ''}`);
      },
    },

    /**
     * Dashboard Statistics
     */
    stats: {
      /**
       * Get dashboard stats for the current user
       */
      get: () => request<StatsResponse>('/v1/stats'),
    },

    /**
     * Agents API - Agent-centric dashboard operations
     */
    agents: {
      /**
       * List all agents for the current user
       */
      list: () => request<AgentsListResponse>('/v1/agents'),

      /**
       * Get a single agent by ID
       */
      get: (agentId: string) => request<AgentDetailResponse>(`/v1/agents/${agentId}`),

      /**
       * Update an agent (rename)
       */
      update: (agentId: string, name: string) =>
        request<AgentDetailResponse>(`/v1/agents/${agentId}`, {
          method: 'PUT',
          body: JSON.stringify({ name }),
        }),

      /**
       * Delete an agent and all its scan history
       */
      delete: (agentId: string) =>
        request<{ success: boolean }>(`/v1/agents/${agentId}`, {
          method: 'DELETE',
        }),
    },

    /**
     * Scans API - Individual scan operations
     */
    scans: {
      /**
       * Get a single scan with full data (findings, topology, strengths)
       * Used for re-opening previous scan results
       */
      get: (scanId: string) => request<ScanDetailResponse>(`/v1/scans/${scanId}`),

      /**
       * Export scan as JSON (structured ExportData format)
       */
      exportJSON: (scanId: string) => request<ExportData>(`/v1/scans/${scanId}/export/json`),

      /**
       * Export scan as SARIF v2.1.0 (GitHub Security compatible)
       */
      exportSARIF: (scanId: string) => request<SARIFReport>(`/v1/scans/${scanId}/export/sarif`),

      /**
       * Get diff between this scan and a previous scan
       * Compares to previous scan of same agent if no baseScanId provided
       */
      diff: (scanId: string, baseScanId?: string) => {
        const url = baseScanId
          ? `/v1/scans/${scanId}/diff?base=${baseScanId}`
          : `/v1/scans/${scanId}/diff`;
        return request<DiffResponse>(url);
      },

      /**
       * Export scan as PDF (compliance report)
       * Returns a Blob for download
       */
      exportPDF: async (scanId: string): Promise<Blob> => {
        const token = await getToken();
        if (!token) {
          throw new InkogAPIError('Not authenticated', 'not_authenticated', 401);
        }

        const response = await fetchWithRetry(`${API_BASE_URL}/v1/scans/${scanId}/export/pdf`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = await response.json() as APIError;
          throw new InkogAPIError(
            data.message || data.error || 'Export failed',
            data.code || 'export_error',
            response.status
          );
        }

        return response.blob();
      },
    },

    /**
     * Web Scanner
     */
    scan: {
      /**
       * Scan uploaded code files
       * Uses multipart form data to upload files
       */
      upload: async (files: File[], policy?: string, agentName?: string): Promise<ScanResult> => {
        const token = await getToken();

        if (!token) {
          throw new InkogAPIError('Not authenticated', 'not_authenticated', 401);
        }

        const formData = new FormData();

        // Add required request metadata (matches backend contract)
        const requestMetadata = {
          contract_version: 'v1',
          cli_version: 'dashboard-1.0.0',
          secrets_version: '',
          local_secrets_found: 0,
          redacted_file_count: 0,
          scan_policy: policy || 'balanced',
          agent_name: agentName || '',
        };
        formData.append('request', JSON.stringify(requestMetadata));

        // Add files
        files.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetchWithRetry(`${API_BASE_URL}/api/v1/scan`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // Note: Don't set Content-Type for FormData, browser sets it with boundary
          },
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          const error = data as APIError;
          throw new InkogAPIError(
            error.message || error.error || 'Scan failed',
            error.code || 'scan_error',
            response.status
          );
        }

        // Transform backend response to frontend format with defensive defaults
        return transformScanResponse(data as BackendScanResponse);
      },
    },

    /**
     * Organizations API - Multi-org support
     */
    orgs: {
      /**
       * List organizations the user belongs to
       */
      list: () => request<OrganizationsListResponse>('/v1/orgs'),

      /**
       * Get organization details
       */
      get: (orgId: string) => request<{ organization: Organization }>(`/v1/orgs/${orgId}`),

      /**
       * Get organization members (requires admin/owner role)
       */
      members: (orgId: string) => request<OrgMembersResponse>(`/v1/orgs/${orgId}/members`),

      /**
       * Get organization statistics
       */
      stats: (orgId: string) => request<OrgStatsResponse>(`/v1/orgs/${orgId}/stats`),

      /**
       * Get scans for an organization
       */
      scans: (orgId: string, options?: { limit?: number; offset?: number }) => {
        const params = new URLSearchParams();
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.offset) params.set('offset', options.offset.toString());
        const query = params.toString();
        return request<{ scans: Scan[]; total: number; has_more: boolean }>(
          `/v1/orgs/${orgId}/scans${query ? `?${query}` : ''}`
        );
      },

      /**
       * Get API keys for an organization (requires admin/owner role)
       */
      apiKeys: (orgId: string) => request<{ api_keys: APIKey[]; total: number }>(
        `/v1/orgs/${orgId}/api-keys`
      ),

      /**
       * Create API key for an organization (requires admin/owner role)
       */
      createApiKey: (orgId: string, name: string, scopes: string[]) =>
        request<CreateKeyResponse>(`/v1/orgs/${orgId}/api-keys`, {
          method: 'POST',
          body: JSON.stringify({ name, scopes }),
        }),
    },

    /**
     * Suppressions API - Baseline and exception management
     */
    suppressions: {
      /**
       * List suppressions for an organization
       */
      list: (orgId: string, options?: {
        agent_id?: string;
        pattern_id?: string;
        reason?: SuppressionReason;
        include_expired?: boolean;
        include_revoked?: boolean;
        limit?: number;
        offset?: number;
      }) => {
        const params = new URLSearchParams();
        if (options?.agent_id) params.set('agent_id', options.agent_id);
        if (options?.pattern_id) params.set('pattern_id', options.pattern_id);
        if (options?.reason) params.set('reason', options.reason);
        if (options?.include_expired) params.set('include_expired', 'true');
        if (options?.include_revoked) params.set('include_revoked', 'true');
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.offset) params.set('offset', options.offset.toString());
        const query = params.toString();
        return request<SuppressionsListResponse>(
          `/v1/orgs/${orgId}/suppressions${query ? `?${query}` : ''}`
        );
      },

      /**
       * Get a single suppression
       */
      get: (orgId: string, suppressionId: string) =>
        request<{ suppression: Suppression }>(`/v1/orgs/${orgId}/suppressions/${suppressionId}`),

      /**
       * Create a suppression
       */
      create: (orgId: string, data: CreateSuppressionRequest) =>
        request<CreateSuppressionResponse>(`/v1/orgs/${orgId}/suppressions`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      /**
       * Revoke a suppression
       */
      revoke: (orgId: string, suppressionId: string) =>
        request<{ id: string; revoked_at: string }>(`/v1/orgs/${orgId}/suppressions/${suppressionId}`, {
          method: 'DELETE',
        }),

      /**
       * Check if a finding is suppressed
       */
      check: (orgId: string, data: {
        pattern_id: string;
        agent_id?: string;
        file_path?: string;
        line_number?: number;
        finding_hash?: string;
      }) =>
        request<SuppressionCheckResponse>(`/v1/orgs/${orgId}/suppressions/check`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      /**
       * Get suppression statistics
       */
      stats: (orgId: string) =>
        request<{ stats: SuppressionStats }>(`/v1/orgs/${orgId}/suppressions/stats`),
    },

    /**
     * GitHub App Installations
     */
    github: {
      /**
       * Link a GitHub App installation to the current user
       */
      linkInstallation: (installationId: number) =>
        request<{
          success: boolean;
          installation: {
            id: number;
            account: string;
            account_type: string;
            repos: string[];
          };
          backfilled_scans: number;
        }>('/v1/github/installations/link', {
          method: 'POST',
          body: JSON.stringify({ installation_id: installationId }),
        }),

      /**
       * List all GitHub installations linked to the current user (with per-repo scan stats)
       */
      listInstallations: () =>
        request<{
          success: boolean;
          installations: Array<{
            id: number;
            account: string;
            account_type: string;
            created_at: string;
            total_scans: number;
            repos: Array<{
              name: string;
              scan_count: number;
              last_scan_at: string | null;
              last_scan_id: string | null;
              findings_count: number;
              critical_count: number;
              high_count: number;
              status: 'passing' | 'warning' | 'failing' | 'pending';
            }>;
          }>;
        }>('/v1/github/installations'),

      /**
       * Trigger an on-demand scan of a connected GitHub repository.
       * Uses a 180s timeout since repo clone + scan can take up to 170s.
       */
      triggerScan: (params: {
        installation_id: number;
        repo_full_name: string;
      }) =>
        request<{
          success: boolean;
          scan_id: string;
          findings_count: number;
          critical_count: number;
          high_count: number;
          medium_count: number;
          status: 'passing' | 'warning' | 'failing';
        }>('/v1/github/trigger-scan', {
          method: 'POST',
          body: JSON.stringify(params),
        }, 180_000),
    },
  };
}

/**
 * Type for the API client
 */
export type InkogAPI = ReturnType<typeof createAPIClient>;
