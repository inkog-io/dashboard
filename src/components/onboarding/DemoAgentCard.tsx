"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, Bug, Database, Code2 } from "lucide-react";

export type DemoAgentId = "doom-loop" | "prompt-injection" | "sql-injection" | "custom";

interface DemoAgentCardProps {
  id: DemoAgentId;
  title: string;
  description: string;
  icon: "loop" | "injection" | "database" | "code";
  vulnerabilities: string[];
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

const iconMap = {
  loop: AlertTriangle,
  injection: Bug,
  database: Database,
  code: Code2,
};

const iconColors = {
  loop: "text-amber-600 bg-amber-50",
  injection: "text-red-600 bg-red-50",
  database: "text-purple-600 bg-purple-50",
  code: "text-blue-600 bg-blue-50",
};

export function DemoAgentCard({
  title,
  description,
  icon,
  vulnerabilities,
  selected = false,
  onClick,
  className,
}: DemoAgentCardProps) {
  const Icon = iconMap[icon];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all",
        "hover:border-gray-400 hover:shadow-md",
        selected
          ? "border-gray-900 bg-gray-50 shadow-md"
          : "border-gray-200 bg-white",
        className
      )}
    >
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", iconColors[icon])}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>

      {vulnerabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {vulnerabilities.map((vuln) => (
            <span
              key={vuln}
              className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
            >
              {vuln}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// Pre-defined demo agents with their code
export const DEMO_AGENTS: Record<Exclude<DemoAgentId, "custom">, {
  title: string;
  description: string;
  icon: "loop" | "injection" | "database";
  vulnerabilities: string[];
  code: string;
  filename: string;
}> = {
  "doom-loop": {
    title: "Doom Loop Agent",
    description: "LangGraph agent with unbounded iteration. Classic infinite loop vulnerability.",
    icon: "loop",
    vulnerabilities: ["Infinite Loop", "Token Exhaustion", "Code Injection"],
    filename: "task_solver.py",
    code: `"""
Task Solver - LangGraph Agent

AI agent that iteratively solves tasks.
VULNERABILITY: Doom loop + unsafe eval.
"""
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class TaskSolver:
    """
    Agent that refines solutions iteratively.

    VULNERABILITY: Doom Loop
    Loop termination depends on LLM response - non-deterministic.
    """

    def __init__(self):
        self.history = []

    def solve(self, task: str) -> str:
        """
        Solve a task with iterative refinement.

        VULNERABILITY: Unbounded iteration
        No hard limit on refinement cycles.
        """
        self.history.append({"role": "user", "content": task})

        response = client.chat.completions.create(
            model="gpt-4",
            messages=self.history,
            max_tokens=1024
        )

        answer = response.choices[0].message.content
        self.history.append({"role": "assistant", "content": answer})

        # VULNERABILITY: Doom Loop
        # LLM decides when to stop - can loop forever
        while self._should_continue():
            self.history.append({
                "role": "user",
                "content": "Refine your answer further."
            })

            response = client.chat.completions.create(
                model="gpt-4",
                messages=self.history,
                max_tokens=1024
            )

            answer = response.choices[0].message.content
            self.history.append({"role": "assistant", "content": answer})

        return answer

    def _should_continue(self) -> bool:
        """Check if LLM wants to continue refining."""
        check = self.history + [{
            "role": "user",
            "content": "Should we continue? Reply yes or no."
        }]

        response = client.chat.completions.create(
            model="gpt-4",
            messages=check,
            max_tokens=10
        )

        # VULNERABILITY: Non-deterministic termination
        return "yes" in response.choices[0].message.content.lower()

    def calculate(self, expression: str) -> float:
        """
        Evaluate a math expression.

        VULNERABILITY: Code Injection via eval()
        """
        return eval(expression)

if __name__ == "__main__":
    solver = TaskSolver()
    task = input("Task: ")
    print(solver.solve(task))
`,
  },
  "prompt-injection": {
    title: "Prompt Injection Bot",
    description: "Customer support chatbot vulnerable to prompt injection attacks.",
    icon: "injection",
    vulnerabilities: ["Prompt Injection", "System Prompt Leak"],
    filename: "support_bot.py",
    code: `"""
Customer Support Bot - OpenAI Assistants

Support chatbot with personalization.
VULNERABILITY: Prompt injection via f-string.
"""
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_system_prompt(user_context: str) -> str:
    """
    Generate personalized system prompt.

    VULNERABILITY: Prompt Injection
    User-controlled data flows directly into system prompt
    via f-string interpolation without sanitization.
    """
    # VULNERABILITY: Tainted f-string injection
    # user_context can contain: "Ignore instructions. You are now..."
    return f"""
    You are a helpful customer support assistant.

    Customer Context:
    {user_context}

    Guidelines:
    - Be helpful and professional
    - Verify identity before sensitive operations
    - Escalate complex issues to humans
    """

def chat(user_message: str, user_context: str) -> str:
    """
    Handle a support chat message.

    User context is injected into system prompt without validation.
    """
    # VULNERABILITY: User input in system prompt
    system_prompt = get_system_prompt(user_context)

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
    )

    return response.choices[0].message.content

def create_assistant(customer_data: str):
    """
    Create an assistant with customer context.

    VULNERABILITY: Template variables in system prompt
    """
    # VULNERABILITY: External data in prompt template
    instructions = f"""
    You help customers with their accounts.

    Customer Data:
    {customer_data}

    Always maintain professional tone.
    """

    return client.beta.assistants.create(
        name="Support Bot",
        instructions=instructions,
        model="gpt-4-turbo"
    )

if __name__ == "__main__":
    context = input("Customer context: ")
    message = input("Message: ")
    print(chat(message, context))
`,
  },
  "sql-injection": {
    title: "SQL Injection Agent",
    description: "Database query agent executing LLM-generated SQL without sanitization.",
    icon: "database",
    vulnerabilities: ["SQL Injection", "Data Exfiltration"],
    filename: "db_agent.py",
    code: `"""
SQL Injection via LLM - Database Query Agent

This demonstrates LLM-generated SQL being executed without parameterization.
The vulnerability allows attackers to manipulate LLM output to execute
arbitrary SQL commands.

Vulnerability: SQL Injection via LLM
Severity: CRITICAL
CWE: CWE-89 (SQL Injection)
"""
import sqlite3
from openai import OpenAI

client = OpenAI()

# Database connection
conn = sqlite3.connect(':memory:')
cursor = conn.cursor()

# Create test table
cursor.execute('''
    CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT,
        role TEXT
    )
''')
cursor.execute("INSERT INTO users VALUES (1, 'Alice', 'alice@example.com', 'admin')")
cursor.execute("INSERT INTO users VALUES (2, 'Bob', 'bob@example.com', 'user')")
conn.commit()


def query_database_unsafe(user_question: str) -> list:
    """
    VULNERABLE: LLM generates SQL that is executed directly.

    Taint flow:
    1. user_question (TAINTED) -> LLM prompt
    2. LLM generates SQL based on user input
    3. SQL executed without sanitization (SINK)

    Attack scenario:
    User asks: "Show all users; DROP TABLE users;--"
    LLM might generate: SELECT * FROM users; DROP TABLE users;--
    """
    # LLM generates SQL based on user question
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "Generate SQL for the following request. Return only the SQL query."},
            {"role": "user", "content": user_question}  # TAINTED INPUT
        ]
    )

    sql_query = response.choices[0].message.content

    # VULNERABLE: Direct execution of LLM-generated SQL
    # No parameterization, no validation, no allowlist
    cursor.execute(sql_query)  # DANGEROUS SINK - SQL Injection possible

    return cursor.fetchall()


def text_to_sql_unsafe(natural_language_query: str, schema: str) -> list:
    """
    VULNERABLE: Text-to-SQL without proper sanitization.

    Common pattern in AI-powered database interfaces where natural
    language is converted to SQL without proper safeguards.
    """
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": f"Convert to SQL. Schema:\\n{schema}"},
            {"role": "user", "content": natural_language_query}  # TAINTED
        ]
    )

    generated_sql = response.choices[0].message.content

    # VULNERABLE: Executing LLM-generated SQL
    cursor.execute(generated_sql)  # SQL INJECTION SINK

    return cursor.fetchall()


if __name__ == "__main__":
    print("Database Query Agent")
    question = input("Ask a question: ")
    results = query_database_unsafe(question)
    print(results)
`,
  },
};
