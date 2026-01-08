"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Terminal,
  Puzzle,
  Github,
  Code2,
  Zap,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StepIndicator,
  ScanMethodCard,
  CopyCommand,
  DemoAgentCard,
  DEMO_AGENTS,
  ScanProgress,
  QuickScanResults,
  type DemoAgentId,
  type Step,
} from "@/components/onboarding";
import { createAPIClient, type ScanResult } from "@/lib/api";
import {
  type ScanMethod,
  type OnboardingStep as AnalyticsStep,
  trackOnboardingStarted,
  trackScanMethodSelected,
  trackOnboardingCompleted,
  startOnboarding,
  saveOnboardingState,
} from "@/lib/analytics";

// Steps for the quick demo flow
const DEMO_STEPS: Step[] = [
  { id: "method", label: "Choose Method" },
  { id: "demo", label: "Select Agent" },
  { id: "scan", label: "Scan" },
  { id: "results", label: "Results" },
];

type OnboardingStep = "method" | "demo" | "scan" | "results" | "setup";

export default function OnboardingPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const api = createAPIClient(getToken);

  // State
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("method");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [selectedDemoAgent, setSelectedDemoAgent] = useState<DemoAgentId | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Track onboarding start on mount
  useState(() => {
    startOnboarding();
    trackOnboardingStarted({ first_visit: true });
  });

  // Get current step index for the indicator
  const getCurrentStepIndex = () => {
    switch (currentStep) {
      case "method": return 0;
      case "demo": return 1;
      case "scan": return 2;
      case "results": return 3;
      case "setup": return 3;
      default: return 0;
    }
  };

  // Handle method selection
  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    trackScanMethodSelected({ method: method as ScanMethod, step: "scan_method" as AnalyticsStep });
    saveOnboardingState({ scanMethodChosen: method as ScanMethod });

    if (method === "quick-demo") {
      setCurrentStep("demo");
    } else {
      setCurrentStep("setup");
    }
  };

  // Handle demo agent selection and start scan
  const handleDemoSelect = async (agentId: DemoAgentId) => {
    setSelectedDemoAgent(agentId);

    if (agentId === "custom") {
      // For custom code, redirect to full scan page
      router.push("/dashboard/scan");
      return;
    }

    // Start the scan
    setCurrentStep("scan");
    setIsScanning(true);
    setScanError(null);

    try {
      const agent = DEMO_AGENTS[agentId];
      const codeBlob = new Blob([agent.code], { type: "text/plain" });
      const file = new File([codeBlob], agent.filename, { type: "text/plain" });

      const result = await api.scan.upload([file], "balanced", agent.title);
      setScanResult(result);
      setCurrentStep("results");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Scan failed";
      setScanError(errorMessage);
      setCurrentStep("results");
    } finally {
      setIsScanning(false);
    }
  };

  // Handle scan complete animation
  const handleScanAnimationComplete = useCallback(() => {
    // Animation complete - actual scan might still be running
  }, []);

  // Navigate to full report
  const handleViewFullReport = () => {
    // Mark onboarding as complete since they've seen results
    trackOnboardingCompleted({
      duration_seconds: 0,
      steps_completed: 4,
      scan_method_chosen: (selectedMethod as ScanMethod) || "upload",
    });
    saveOnboardingState({ hasCompletedOnboarding: true });
    router.push("/dashboard?completed=true");
  };

  // Navigate to dashboard
  const handleContinue = () => {
    trackOnboardingCompleted({
      duration_seconds: 0,
      steps_completed: 4,
      scan_method_chosen: (selectedMethod as ScanMethod) || "upload",
    });
    saveOnboardingState({ hasCompletedOnboarding: true });
    router.push("/dashboard?completed=true");
  };

  // Go back
  const handleBack = () => {
    if (currentStep === "demo") {
      setCurrentStep("method");
      setSelectedDemoAgent(null);
    } else if (currentStep === "setup") {
      setCurrentStep("method");
      setSelectedMethod(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">Inkog</span>
            </div>

            {/* Step indicator - only show for quick demo flow */}
            {selectedMethod === "quick-demo" && currentStep !== "method" && (
              <div className="hidden sm:block">
                <StepIndicator
                  steps={DEMO_STEPS}
                  currentStep={getCurrentStepIndex()}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Step 1: Choose Method */}
        {currentStep === "method" && (
          <div className="animate-in fade-in duration-300">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome to Inkog
              </h1>
              <p className="mt-2 text-gray-600 max-w-md mx-auto">
                Secure your AI agents. Detect vulnerabilities. Ship with confidence.
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <h2 className="text-sm font-medium text-gray-700 mb-4">
                How would you like to try Inkog?
              </h2>

              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                {/* Quick Demo - Highlighted */}
                <ScanMethodCard
                  icon={Zap}
                  title="Quick Demo"
                  description="Scan a demo agent in 30 seconds. See real vulnerabilities."
                  recommended
                  selected={selectedMethod === "quick-demo"}
                  onClick={() => handleMethodSelect("quick-demo")}
                  className="sm:col-span-2 sm:max-w-md sm:mx-auto"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-gray-500">
                    Or integrate with your workflow
                  </span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                <ScanMethodCard
                  icon={Terminal}
                  title="CLI"
                  description="Command line tool for local scans"
                  selected={selectedMethod === "cli"}
                  onClick={() => handleMethodSelect("cli")}
                />
                <ScanMethodCard
                  icon={Puzzle}
                  title="MCP Server"
                  description="Claude Desktop & Cursor integration"
                  selected={selectedMethod === "mcp"}
                  onClick={() => handleMethodSelect("mcp")}
                />
                <ScanMethodCard
                  icon={Github}
                  title="GitHub Action"
                  description="Scan on every pull request"
                  selected={selectedMethod === "github"}
                  onClick={() => handleMethodSelect("github")}
                />
                <ScanMethodCard
                  icon={Code2}
                  title="REST API"
                  description="Programmatic integration"
                  selected={selectedMethod === "api"}
                  onClick={() => handleMethodSelect("api")}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Select Demo Agent */}
        {currentStep === "demo" && (
          <div className="animate-in fade-in duration-300">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="text-center mb-10">
              <h1 className="text-2xl font-bold text-gray-900">
                Select a Demo Agent
              </h1>
              <p className="mt-2 text-gray-600">
                Choose an agent with known vulnerabilities to see Inkog in action
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <DemoAgentCard
                id="doom-loop"
                title={DEMO_AGENTS["doom-loop"].title}
                description={DEMO_AGENTS["doom-loop"].description}
                icon={DEMO_AGENTS["doom-loop"].icon}
                vulnerabilities={DEMO_AGENTS["doom-loop"].vulnerabilities}
                selected={selectedDemoAgent === "doom-loop"}
                onClick={() => handleDemoSelect("doom-loop")}
              />
              <DemoAgentCard
                id="prompt-injection"
                title={DEMO_AGENTS["prompt-injection"].title}
                description={DEMO_AGENTS["prompt-injection"].description}
                icon={DEMO_AGENTS["prompt-injection"].icon}
                vulnerabilities={DEMO_AGENTS["prompt-injection"].vulnerabilities}
                selected={selectedDemoAgent === "prompt-injection"}
                onClick={() => handleDemoSelect("prompt-injection")}
              />
              <DemoAgentCard
                id="sql-injection"
                title={DEMO_AGENTS["sql-injection"].title}
                description={DEMO_AGENTS["sql-injection"].description}
                icon={DEMO_AGENTS["sql-injection"].icon}
                vulnerabilities={DEMO_AGENTS["sql-injection"].vulnerabilities}
                selected={selectedDemoAgent === "sql-injection"}
                onClick={() => handleDemoSelect("sql-injection")}
              />
              <DemoAgentCard
                id="custom"
                title="Scan Your Code"
                description="Upload or paste your own agent code"
                icon="code"
                vulnerabilities={[]}
                selected={selectedDemoAgent === "custom"}
                onClick={() => handleDemoSelect("custom")}
              />
            </div>
          </div>
        )}

        {/* Step 3: Scanning */}
        {currentStep === "scan" && (
          <div className="animate-in fade-in duration-300 py-12">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">
                Analyzing Agent
              </h1>
              <p className="mt-2 text-gray-600">
                {selectedDemoAgent && selectedDemoAgent !== "custom"
                  ? DEMO_AGENTS[selectedDemoAgent].title
                  : "Your code"}
              </p>
            </div>

            <ScanProgress
              isScanning={isScanning}
              onComplete={handleScanAnimationComplete}
            />
          </div>
        )}

        {/* Step 4: Results */}
        {currentStep === "results" && (
          <div className="animate-in fade-in duration-300 py-8">
            {scanError ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                  <Zap className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Scan Failed
                </h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  {scanError}
                </p>
                <Button onClick={() => setCurrentStep("demo")}>
                  Try Again
                </Button>
              </div>
            ) : scanResult ? (
              <QuickScanResults
                result={scanResult}
                agentName={
                  selectedDemoAgent && selectedDemoAgent !== "custom"
                    ? DEMO_AGENTS[selectedDemoAgent].title
                    : "Your Agent"
                }
                onContinue={handleContinue}
                onViewFullReport={handleViewFullReport}
              />
            ) : null}
          </div>
        )}

        {/* Setup Instructions (non-quick-demo methods) */}
        {currentStep === "setup" && (
          <div className="animate-in fade-in duration-300">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="max-w-2xl mx-auto">
              {selectedMethod === "cli" && (
                <>
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 mb-4">
                      <Terminal className="w-6 h-6 text-gray-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      Install the CLI
                    </h1>
                    <p className="mt-2 text-gray-600">
                      Scan agents from your terminal
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Install with Homebrew
                      </h3>
                      <CopyCommand command="brew install inkog-io/tap/inkog" />
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Or download directly
                      </h3>
                      <CopyCommand command="curl -sSL https://get.inkog.io | sh" />
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Run your first scan
                      </h3>
                      <CopyCommand command="inkog scan ./my-agent" />
                    </div>
                  </div>
                </>
              )}

              {selectedMethod === "mcp" && (
                <>
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 mb-4">
                      <Puzzle className="w-6 h-6 text-gray-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      MCP Server Setup
                    </h1>
                    <p className="mt-2 text-gray-600">
                      Use Inkog directly in Claude Desktop or Cursor
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Add to your Claude Desktop config
                      </h3>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-sm text-gray-100">
{`{
  "mcpServers": {
    "inkog": {
      "command": "npx",
      "args": ["@inkog-io/mcp"]
    }
  }
}`}
                        </pre>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Config location: ~/Library/Application Support/Claude/claude_desktop_config.json
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Then ask Claude
                      </h3>
                      <CopyCommand command="Scan my agent code for security vulnerabilities" />
                    </div>
                  </div>
                </>
              )}

              {selectedMethod === "github" && (
                <>
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 mb-4">
                      <Github className="w-6 h-6 text-gray-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      GitHub Action
                    </h1>
                    <p className="mt-2 text-gray-600">
                      Automatic security scans on every PR
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Add to .github/workflows/inkog.yml
                      </h3>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-sm text-gray-100">
{`name: Inkog Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: inkog-io/action@v1
        with:
          path: ./agents`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedMethod === "api" && (
                <>
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 mb-4">
                      <Code2 className="w-6 h-6 text-gray-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      REST API
                    </h1>
                    <p className="mt-2 text-gray-600">
                      Integrate Inkog into your pipeline
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Scan with cURL
                      </h3>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-sm text-gray-100">
{`curl -X POST https://api.inkog.io/v1/scan \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"files": [{"path": "agent.py", "content": "..."}]}'`}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        API Documentation
                      </h3>
                      <a
                        href="https://docs.inkog.io/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-gray-900 hover:underline"
                      >
                        View full API reference
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </>
              )}

              {/* Continue button */}
              <div className="mt-10 flex justify-center">
                <Button onClick={handleContinue} className="bg-gray-900 hover:bg-gray-800">
                  Continue to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
