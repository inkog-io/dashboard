/**
 * Remediation guides for security patterns
 *
 * Each guide provides actionable steps to fix the detected issue
 * along with optional code examples.
 */

export interface RemediationGuide {
  title: string;
  steps: string[];
  codeExample?: string;
}

const remediationGuides: Record<string, RemediationGuide> = {
  // === Tier 1: Critical Vulnerabilities ===

  universal_infinite_loop: {
    title: "Add Loop Termination Guards",
    steps: [
      "Add a max_iterations parameter to limit loop cycles",
      "Implement a timeout mechanism (e.g., 30 second deadline)",
      "Add explicit break conditions based on business logic",
      "Log iteration count for monitoring runaway agents",
    ],
    codeExample: `# Before (vulnerable)
while agent.needs_more_work():
    agent.run()

# After (safe)
MAX_ITERATIONS = 100
for i in range(MAX_ITERATIONS):
    if not agent.needs_more_work():
        break
    agent.run()
else:
    logger.warning("Agent hit max iterations")`,
  },

  universal_prompt_injection: {
    title: "Sanitize User Input in Prompts",
    steps: [
      "Never concatenate raw user input into system prompts",
      "Use structured message formats with clear role boundaries",
      "Validate and sanitize all user-provided content",
      "Consider using input allowlists for expected formats",
    ],
    codeExample: `# Before (vulnerable)
prompt = f"You are a helpful assistant. User says: {user_input}"

# After (safe)
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": sanitize(user_input)}
]`,
  },

  universal_hardcoded_credentials: {
    title: "Move Credentials to Environment Variables",
    steps: [
      "Remove hardcoded API keys, passwords, and tokens from source code",
      "Use environment variables or a secrets manager",
      "Add credential files to .gitignore",
      "Rotate any credentials that were committed to version control",
    ],
    codeExample: `# Before (vulnerable)
api_key = "sk-1234567890abcdef"

# After (safe)
import os
api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not set")`,
  },

  universal_sql_injection: {
    title: "Use Parameterized Queries",
    steps: [
      "Never interpolate user input directly into SQL strings",
      "Use parameterized queries or prepared statements",
      "Apply input validation and type checking",
      "Use an ORM with built-in injection protection",
    ],
    codeExample: `# Before (vulnerable)
query = f"SELECT * FROM users WHERE name = '{user_input}'"

# After (safe)
query = "SELECT * FROM users WHERE name = %s"
cursor.execute(query, (user_input,))`,
  },

  universal_exec_eval: {
    title: "Avoid Dynamic Code Execution",
    steps: [
      "Remove eval(), exec(), or similar dynamic execution",
      "Use structured data formats (JSON) instead of code strings",
      "If dynamic execution is required, use strict sandboxing",
      "Implement allowlists for permitted operations",
    ],
    codeExample: `# Before (vulnerable)
result = eval(llm_response)

# After (safe)
import json
result = json.loads(llm_response)
if result.get("action") in ALLOWED_ACTIONS:
    perform_action(result)`,
  },

  // === Tier 2: Risk Patterns ===

  universal_token_bombing: {
    title: "Limit Token Consumption",
    steps: [
      "Set max_tokens parameter on all LLM calls",
      "Implement cost budgets per user/session",
      "Add circuit breakers for runaway token usage",
      "Monitor and alert on unusual consumption patterns",
    ],
    codeExample: `# Before (no limits)
response = client.chat.completions.create(
    model="gpt-4",
    messages=messages
)

# After (with limits)
response = client.chat.completions.create(
    model="gpt-4",
    messages=messages,
    max_tokens=1000  # Explicit limit
)`,
  },

  universal_context_exhaustion: {
    title: "Manage Context Window Size",
    steps: [
      "Implement message pruning for long conversations",
      "Use summarization for historical context",
      "Set explicit limits on conversation length",
      "Monitor context size before each API call",
    ],
    codeExample: `# Context management
MAX_CONTEXT_MESSAGES = 20

def prune_context(messages):
    if len(messages) > MAX_CONTEXT_MESSAGES:
        # Keep system prompt + recent messages
        return [messages[0]] + messages[-MAX_CONTEXT_MESSAGES:]
    return messages`,
  },

  universal_recursive_tool_calling: {
    title: "Limit Tool Call Recursion Depth",
    steps: [
      "Track and limit the number of tool calls per request",
      "Implement call depth tracking for recursive tools",
      "Add circuit breakers for excessive tool chaining",
      "Log tool call patterns for analysis",
    ],
    codeExample: `MAX_TOOL_CALLS = 10

def run_agent(query, tool_call_count=0):
    if tool_call_count >= MAX_TOOL_CALLS:
        return "Maximum tool calls reached"

    result = agent.run(query)
    if result.needs_tool_call:
        return run_agent(result.next_query, tool_call_count + 1)
    return result`,
  },

  universal_missing_rate_limits: {
    title: "Implement Rate Limiting",
    steps: [
      "Add rate limits at API gateway level",
      "Implement per-user and per-IP limits",
      "Use token bucket or sliding window algorithms",
      "Return proper 429 responses with Retry-After headers",
    ],
    codeExample: `from ratelimit import limits, sleep_and_retry

@sleep_and_retry
@limits(calls=10, period=60)  # 10 calls per minute
def call_llm(prompt):
    return client.chat.completions.create(...)`,
  },

  universal_rag_overfetching: {
    title: "Limit RAG Retrieved Content",
    steps: [
      "Set explicit limits on number of retrieved documents",
      "Implement token-based chunking for retrieved content",
      "Filter and rank results before including in context",
      "Add relevance thresholds for inclusion",
    ],
    codeExample: `# Before (overfetching)
docs = retriever.get_all_relevant(query)

# After (limited)
docs = retriever.get_relevant(
    query,
    max_docs=5,
    min_relevance=0.7,
    max_tokens=2000
)`,
  },

  // === Tier 3: Governance & Hardening ===

  universal_missing_oversight: {
    title: "Add Human Oversight Controls",
    steps: [
      "Implement approval workflows for high-risk actions",
      "Add confirmation prompts before irreversible operations",
      "Create audit logs for all agent decisions",
      "Set up alerting for anomalous behavior",
    ],
    codeExample: `def execute_action(action, context):
    if action.risk_level == "HIGH":
        approval = request_human_approval(action, context)
        if not approval.granted:
            return ActionResult(blocked=True, reason="Awaiting approval")

    result = action.execute()
    audit_log.record(action, result, context)
    return result`,
  },

  universal_missing_authz: {
    title: "Add Authorization Checks",
    steps: [
      "Verify user permissions before sensitive operations",
      "Implement role-based access control (RBAC)",
      "Check authorization at the tool/function level",
      "Log all authorization decisions",
    ],
    codeExample: `def execute_tool(user, tool_name, params):
    if not user.has_permission(f"tool:{tool_name}"):
        raise AuthorizationError(f"User lacks permission for {tool_name}")

    return tools[tool_name].execute(params)`,
  },

  universal_cross_tenant: {
    title: "Enforce Tenant Isolation",
    steps: [
      "Add tenant_id filters to all database queries",
      "Implement row-level security policies",
      "Validate tenant context on every request",
      "Use separate connections/schemas per tenant if possible",
    ],
    codeExample: `def get_user_data(tenant_id, user_id):
    # Always filter by tenant
    return db.query(
        "SELECT * FROM data WHERE tenant_id = %s AND user_id = %s",
        (tenant_id, user_id)
    )`,
  },

  universal_logging_sensitive_data: {
    title: "Redact Sensitive Data in Logs",
    steps: [
      "Identify and classify sensitive data fields",
      "Implement log sanitization/redaction filters",
      "Use structured logging with field-level controls",
      "Audit log output to verify no leakage",
    ],
    codeExample: `import re

def sanitize_log(message):
    # Redact API keys
    message = re.sub(r'sk-[a-zA-Z0-9]{32,}', '[REDACTED]', message)
    # Redact emails
    message = re.sub(r'[\\w.-]+@[\\w.-]+', '[EMAIL]', message)
    return message

logger.info(sanitize_log(f"Processing request: {details}"))`,
  },

  universal_output_validation: {
    title: "Validate LLM Output Before Use",
    steps: [
      "Parse LLM responses into structured formats",
      "Validate against expected schemas",
      "Reject malformed or suspicious outputs",
      "Implement fallback behavior for invalid responses",
    ],
    codeExample: `from pydantic import BaseModel, ValidationError

class AgentAction(BaseModel):
    action: str
    target: str
    confidence: float

def parse_llm_response(response):
    try:
        return AgentAction.model_validate_json(response)
    except ValidationError as e:
        logger.warning(f"Invalid LLM response: {e}")
        return None`,
  },

  universal_missing_audit_logging: {
    title: "Implement Comprehensive Audit Logging",
    steps: [
      "Log all agent actions with timestamps and context",
      "Include user identity and request details",
      "Store logs in tamper-evident storage",
      "Implement log retention policies per compliance requirements",
    ],
    codeExample: `def audit_log(event_type, user_id, action, details):
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "user_id": user_id,
        "action": action,
        "details": details,
        "request_id": get_current_request_id()
    }
    audit_store.append(log_entry)`,
  },

  universal_unsafe_deserialization: {
    title: "Use Safe Deserialization",
    steps: [
      "Avoid pickle, yaml.load, or other unsafe deserializers",
      "Use JSON or other safe formats for data exchange",
      "Validate input before deserialization",
      "Implement strict type checking on deserialized data",
    ],
    codeExample: `# Before (vulnerable)
import pickle
data = pickle.loads(user_input)

# After (safe)
import json
data = json.loads(user_input)
validate_schema(data, expected_schema)`,
  },

  universal_excessive_permissions: {
    title: "Apply Principle of Least Privilege",
    steps: [
      "Audit all tool and API permissions",
      "Remove unnecessary capabilities from agents",
      "Implement scoped permissions per task",
      "Regularly review and prune permissions",
    ],
    codeExample: `# Define minimal permissions per task
TASK_PERMISSIONS = {
    "summarize": ["read_document"],
    "send_email": ["read_document", "send_email"],
    "admin": ["read_document", "send_email", "delete_document"]
}

def create_agent(task_type):
    permissions = TASK_PERMISSIONS.get(task_type, [])
    return Agent(permissions=permissions)`,
  },

  universal_prompt_template: {
    title: "Secure Prompt Templates",
    steps: [
      "Use template engines that auto-escape variables",
      "Validate all template parameters before interpolation",
      "Implement content security policies for prompts",
      "Review templates for injection vulnerabilities",
    ],
    codeExample: `from jinja2 import Environment, select_autoescape

env = Environment(autoescape=select_autoescape())
template = env.from_string("User query: {{ user_input | e }}")
safe_prompt = template.render(user_input=raw_input)`,
  },

  universal_pii_filter_wiring: {
    title: "Wire PII Filters to Data Pipeline",
    steps: [
      "Identify all data entry points in the pipeline",
      "Add PII detection and filtering at each entry point",
      "Implement data masking for storage and logs",
      "Test filters with sample PII data",
    ],
    codeExample: `def process_user_input(data):
    # Run PII filter before processing
    filtered_data = pii_filter.scrub(data)

    # Proceed with sanitized data
    return agent.process(filtered_data)`,
  },
};

/**
 * Get remediation guide for a pattern ID
 * Handles pattern ID normalization (removing prefixes, etc.)
 */
export function getRemediationGuide(patternId: string): RemediationGuide | null {
  if (!patternId) return null;

  // Direct lookup
  if (remediationGuides[patternId]) {
    return remediationGuides[patternId];
  }

  // Try with universal_ prefix
  if (remediationGuides[`universal_${patternId}`]) {
    return remediationGuides[`universal_${patternId}`];
  }

  // Try removing universal_ prefix
  const withoutPrefix = patternId.replace(/^universal_/, "");
  if (remediationGuides[withoutPrefix]) {
    return remediationGuides[withoutPrefix];
  }

  return null;
}
