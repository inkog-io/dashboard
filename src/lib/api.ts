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
  files_scanned: number;
  lines_of_code: number;
  findings_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  risk_score: number;
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

export interface HistoryResponse {
  success: boolean;
  scans: Scan[];
  summary?: ScanSummary;
  count: number;
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
  input_tainted: boolean;
  taint_source: string;
  code_snippet?: string;
  // Governance fields (EU AI Act compliance)
  governance_category?: 'oversight' | 'authorization' | 'audit' | 'privacy';
  compliance_mapping?: ComplianceMapping;
}

/**
 * Backend ScanResult - matches pkg/contract/contract.go ScanResult struct exactly
 * This is the raw response from the backend API
 */
export interface BackendScanResult {
  // Metadata
  contract_version: string;
  server_version: string;

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
 * Frontend ScanResult - normalized format for UI components
 * This is what components receive after transformation
 */
export interface ScanResult {
  success: boolean;
  error?: string;

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
    options: RequestInit = {}
  ): Promise<T> {
    const token = await getToken();

    if (!token) {
      throw new InkogAPIError('Not authenticated', 'not_authenticated', 401);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

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
       * Get scan history for the current user
       */
      list: (options?: { limit?: number; summary?: boolean }) => {
        const params = new URLSearchParams();
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.summary) params.set('summary', 'true');
        const query = params.toString();
        return request<HistoryResponse>(`/v1/history${query ? `?${query}` : ''}`);
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
     * Web Scanner
     */
    scan: {
      /**
       * Scan uploaded code files
       * Uses multipart form data to upload files
       */
      upload: async (files: File[]): Promise<ScanResult> => {
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
        };
        formData.append('request', JSON.stringify(requestMetadata));

        // Add files
        files.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetch(`${API_BASE_URL}/api/v1/scan`, {
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
  };
}

/**
 * Type for the API client
 */
export type InkogAPI = ReturnType<typeof createAPIClient>;
