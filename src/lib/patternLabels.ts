/**
 * Developer-friendly pattern labels using LangChain/agent terminology.
 * Maps internal pattern IDs to human-readable titles and descriptions.
 */

export interface PatternLabel {
  title: string;
  shortDesc: string;
}

export const PATTERN_LABELS: Record<string, PatternLabel> = {
  // Resource Exhaustion
  "infinite_loop_semantic": {
    title: "Runaway Agent Loop",
    shortDesc: "Agent loops forever - add max_iterations to AgentExecutor"
  },
  "context_exhaustion_semantic": {
    title: "Memory Overflow",
    shortDesc: "Use ConversationBufferWindowMemory(k=10) instead of unbounded"
  },
  "context_window_accumulation": {
    title: "Context Window Overflow",
    shortDesc: "Conversation history grows unbounded - add memory limits"
  },
  "token_bombing": {
    title: "Token Exhaustion Attack",
    shortDesc: "Set max_tokens limit on LLM calls"
  },
  "recursive_tool_calling": {
    title: "Recursive Tool Chain",
    shortDesc: "Tools call each other without depth limit - use max_iterations"
  },
  "missing_rate_limits": {
    title: "No Rate Limiting",
    shortDesc: "Add rate limiting to prevent abuse"
  },
  "rag_over_fetching": {
    title: "RAG Over-Fetching",
    shortDesc: "Limit retrieved documents to reduce context bloat"
  },

  // Code Injection
  "tainted_eval": {
    title: "Unsafe Code Execution",
    shortDesc: "LLM output passed to exec() - sanitize or use restricted env"
  },
  "unvalidated_exec_eval": {
    title: "Command Injection",
    shortDesc: "User input in shell command without validation"
  },

  // Prompt Security
  "prompt_injection": {
    title: "Prompt Injection",
    shortDesc: "User input in system prompt without escaping"
  },
  "sql_injection_via_llm": {
    title: "SQL Injection via Agent",
    shortDesc: "Use parameterized queries, not string concatenation"
  },

  // Sensitive Data
  "hardcoded_credentials": {
    title: "Hardcoded API Key",
    shortDesc: "Move to environment variables or secrets manager"
  },
  "logging_sensitive_data": {
    title: "Logging Secrets",
    shortDesc: "Redact PII and credentials from logs"
  },
  "unsafe_env_access": {
    title: "Unsafe Environment Access",
    shortDesc: "Validate environment variables and use secrets manager"
  },
  "cross_tenant_data_leakage": {
    title: "Cross-Tenant Data Leak",
    shortDesc: "Add tenant isolation checks to all data queries"
  },

  // Deserialization
  "unsafe_pickle_deserialization": {
    title: "Unsafe Pickle",
    shortDesc: "Use JSON or safe serialization format instead"
  },
  "unsafe_yaml_loading": {
    title: "Unsafe YAML Load",
    shortDesc: "Use yaml.safe_load() instead of yaml.load()"
  },
  "unsafe_deserialization": {
    title: "Unsafe Deserialization",
    shortDesc: "Validate and sanitize serialized input"
  },

  // Output Validation
  "output_validation_failures": {
    title: "Missing Output Validation",
    shortDesc: "Validate LLM output before using in dangerous contexts"
  },

  // Access Control
  "missing_authentication_check": {
    title: "Missing Auth Check",
    shortDesc: "Add authentication before sensitive operations"
  },
  "path_traversal": {
    title: "Path Traversal",
    shortDesc: "Canonicalize paths and validate against allowlist"
  },
  "unvalidated_redirect": {
    title: "Open Redirect",
    shortDesc: "Validate redirect URLs against allowlist"
  },

  // Governance Controls (EU AI Act)
  "governance-mismatch-write_violation": {
    title: "AGENTS.md Violation: Writes Forbidden",
    shortDesc: "Code performs writes but AGENTS.md declares read-only access"
  },
  "governance-mismatch-delete_violation": {
    title: "AGENTS.md Violation: Deletes Forbidden",
    shortDesc: "Code performs deletes but AGENTS.md declares no delete access"
  },
  "governance-mismatch-execute_violation": {
    title: "AGENTS.md Violation: Execution Forbidden",
    shortDesc: "Code executes commands but AGENTS.md declares no execution allowed"
  },
  "governance-mismatch-external_api_violation": {
    title: "AGENTS.md Violation: External API Forbidden",
    shortDesc: "Code calls external APIs but AGENTS.md declares no external API access"
  },
  "governance-mismatch-network_violation": {
    title: "AGENTS.md Violation: Network Forbidden",
    shortDesc: "Code performs network operations but AGENTS.md declares no network access"
  },
  "governance-mismatch-file_violation": {
    title: "AGENTS.md Violation: File Access Forbidden",
    shortDesc: "Code accesses files but AGENTS.md declares no file system access"
  },
  "missing_human_oversight": {
    title: "No Human-in-the-Loop",
    shortDesc: "Add HumanApprovalCallbackHandler for high-risk actions"
  },
  "missing_authorization": {
    title: "Missing Authorization",
    shortDesc: "Add permission checks before tool execution"
  },
  "missing_audit_logging": {
    title: "Missing Audit Trail",
    shortDesc: "Log all agent actions for compliance"
  },

  // Other
  "regex_denial_of_service": {
    title: "ReDoS Vulnerability",
    shortDesc: "Simplify regex patterns to prevent exponential backtracking"
  },
  "insecure_random_generation": {
    title: "Weak Random",
    shortDesc: "Use secrets.token_bytes() for cryptographic operations"
  },
  "race_condition": {
    title: "Race Condition",
    shortDesc: "Use locks or atomic operations for shared state"
  },
};

/**
 * Get developer-friendly label for a pattern ID.
 * Falls back to title-casing the pattern ID if not found.
 */
export function getPatternLabel(patternId: string): PatternLabel {
  // Check for exact match
  if (PATTERN_LABELS[patternId]) {
    return PATTERN_LABELS[patternId];
  }

  // Check for partial match (e.g., "infinite_loop" matches "infinite_loop_semantic")
  for (const [key, label] of Object.entries(PATTERN_LABELS)) {
    if (patternId.includes(key) || key.includes(patternId)) {
      return label;
    }
  }

  // Fallback: Title-case the pattern ID
  return {
    title: patternId
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    shortDesc: "Security issue detected"
  };
}
