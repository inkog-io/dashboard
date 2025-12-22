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
  api_key_count: number;
  scans_today: number;
  total_findings: number;
  last_scan_at: string | null;
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

export interface ScanResult {
  success: boolean;
  findings: Finding[];
  summary: {
    files_scanned: number;
    lines_of_code: number;
    findings_count: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    risk_score: number;
    duration_ms: number;
    // Governance fields
    governance_score?: number;          // 0-100 score
    eu_ai_act_readiness?: 'READY' | 'PARTIAL' | 'NOT_READY';
    article_mapping?: Record<string, ArticleStatus>;
    framework_mapping?: Record<string, FrameworkStatus>;
  };
}

export interface StatsResponse {
  success: boolean;
  stats: DashboardStats;
}

export interface APIError {
  error: string;
  code: string;
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
        error.error || 'Request failed',
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
            error.error || 'Scan failed',
            error.code || 'scan_error',
            response.status
          );
        }

        return data as ScanResult;
      },
    },
  };
}

/**
 * Type for the API client
 */
export type InkogAPI = ReturnType<typeof createAPIClient>;
