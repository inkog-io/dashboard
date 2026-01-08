"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Terminal,
  Upload,
  Github,
  Code,
  Key,
  Check,
  Copy,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Puzzle,
  Zap,
  FlaskConical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepIndicator, ScanMethodCard, CopyCommand } from "@/components/onboarding";
import { createAPIClient, type InkogAPI } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import {
  type ScanMethod,
  type CliInstallMethod,
  trackOnboardingStarted,
  trackScanMethodSelected,
  trackCliCommandCopied,
  trackOnboardingCompleted,
  trackOnboardingSkipped,
  trackApiKeyCreated,
  startOnboarding,
  saveOnboardingState,
} from "@/lib/analytics";

// Dynamic steps based on selected method
const getSteps = (method: ScanMethod | null) => {
  if (method === "upload") {
    // Upload flow: just choose method, then go to scan
    return [{ id: "scan_method", label: "Choose Method" }];
  }
  // Production methods: Choose Method → API Key → Get Started
  return [
    { id: "scan_method", label: "Choose Method" },
    { id: "api_key", label: "API Key" },
    { id: "get_started", label: "Get Started" },
  ];
};

// Production methods (require API key)
const PRODUCTION_METHODS = [
  {
    id: "cli" as ScanMethod,
    icon: Terminal,
    title: "CLI",
    description: "Best for local development and CI/CD pipelines",
  },
  {
    id: "mcp" as ScanMethod,
    icon: Puzzle,
    title: "MCP Server",
    description: "Use Inkog in Claude Desktop or Cursor",
  },
  {
    id: "github" as ScanMethod,
    icon: Github,
    title: "GitHub Actions",
    description: "Automated scanning on every pull request",
  },
  {
    id: "api" as ScanMethod,
    icon: Code,
    title: "API",
    description: "Direct integration for custom workflows",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const toast = useToast();

  const [api, setApi] = useState<InkogAPI | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Scan method state
  const [selectedMethod, setSelectedMethod] = useState<ScanMethod | null>(null);

  // Step 2: API Key state
  const [keyName, setKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [existingKeyValue, setExistingKeyValue] = useState<string | null>(null);

  // Get dynamic steps based on selected method
  const steps = getSteps(selectedMethod);

  // Initialize API client and check for existing keys
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);

    // Start onboarding tracking
    startOnboarding();
    trackOnboardingStarted({ first_visit: true });

    // Check if user already has API keys
    client.keys.list().then((response) => {
      if (response.api_keys.length > 0) {
        setHasExistingKey(true);
        // Store the key name for reference (we can't show the actual key)
      }
    }).catch(() => {
      // Ignore errors - user might not have keys yet
    });
  }, [getToken]);

  // Generate API key
  const handleGenerateKey = async () => {
    if (!api) return;

    setLoading(true);
    try {
      const response = await api.keys.create(keyName || "My First Key");
      setGeneratedKey(response.key);
      trackApiKeyCreated({
        key_name: keyName || "My First Key",
        from_onboarding: true,
      });
      toast.success({ title: "API key generated!", description: "Copy it now - you won't see it again." });
    } catch (err) {
      toast.handleAPIError(err, "Failed to generate API key");
    } finally {
      setLoading(false);
    }
  };

  // Copy API key
  const handleCopyKey = async () => {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  // Handle method selection
  const handleMethodSelect = (method: ScanMethod) => {
    setSelectedMethod(method);
    trackScanMethodSelected({
      method,
      step: "scan_method",
    });
    saveOnboardingState({ scanMethodChosen: method });
  };

  // Handle Upload quick action - go directly to scan page
  const handleUploadSelect = () => {
    trackScanMethodSelected({
      method: "upload",
      step: "scan_method",
    });
    trackOnboardingCompleted({
      duration_seconds: 0,
      steps_completed: 1,
      scan_method_chosen: "upload",
    });
    saveOnboardingState({ hasCompletedOnboarding: true, scanMethodChosen: "upload" });
    router.push("/dashboard/scan?completed=true");
  };

  // Track CLI command copies
  const handleCliCopy = useCallback((commandType: CliInstallMethod, command: string) => {
    trackCliCommandCopied({
      command_type: commandType,
      step: "get_started",
      command,
    });
  }, []);

  // Complete onboarding
  const handleComplete = () => {
    trackOnboardingCompleted({
      duration_seconds: 0,
      steps_completed: steps.length,
      scan_method_chosen: selectedMethod || "cli",
    });
    saveOnboardingState({ hasCompletedOnboarding: true });

    // Navigate based on selected method
    switch (selectedMethod) {
      case "github":
        window.open("https://docs.inkog.io/ci-cd/github-actions", "_blank");
        router.push("/dashboard?completed=true");
        break;
      default:
        router.push("/dashboard?completed=true");
    }
  };

  // Skip onboarding
  const handleSkip = () => {
    trackOnboardingSkipped({
      skipped_at_step: steps[currentStep]?.id as "api_key" | "scan_method" | "first_scan",
      steps_completed: currentStep,
    });
    saveOnboardingState({ hasCompletedOnboarding: true });
    router.push("/dashboard?completed=true");
  };

  // Navigate between steps
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Check if can proceed to next step
  const canProceed = () => {
    const stepId = steps[currentStep]?.id;
    switch (stepId) {
      case "scan_method":
        return selectedMethod !== null;
      case "api_key":
        return generatedKey !== null || hasExistingKey;
      default:
        return true;
    }
  };

  // Get the API key to display in instructions
  const displayApiKey = generatedKey || "your-api-key";

  // Determine current step content
  const currentStepId = steps[currentStep]?.id;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">I</span>
            </div>
            <span className="font-semibold text-lg">Welcome to Inkog</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip setup
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 py-8 px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Step indicator */}
          <StepIndicator steps={steps} currentStep={currentStep} />

          {/* Step content */}
          <Card>
            {/* Step 1: Choose Method */}
            {currentStepId === "scan_method" && (
              <>
                <CardHeader>
                  <CardTitle>How do you want to scan?</CardTitle>
                  <CardDescription>
                    Choose the method that works best for your workflow.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Quick Test Option - Highlighted */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Quick Test
                    </h3>
                    <button
                      onClick={handleUploadSelect}
                      className="w-full p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 transition-all text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 p-2 bg-amber-100 rounded-lg">
                          <Upload className="h-5 w-5 text-amber-700" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">Upload Files</h4>
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 text-amber-800 rounded-full">
                              Try It Now
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Drag & drop files in the browser to see Inkog in action
                          </p>
                          <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                            <FlaskConical className="h-3 w-3" />
                            Demo examples available if you don&apos;t have code ready
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-amber-600 flex-shrink-0" />
                      </div>
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Best for quick testing. For production use, choose a method below.
                    </p>
                  </div>

                  {/* Production Methods */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                      Production Integration
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {PRODUCTION_METHODS.map((method) => (
                        <ScanMethodCard
                          key={method.id}
                          icon={method.icon}
                          title={method.title}
                          description={method.description}
                          selected={selectedMethod === method.id}
                          onClick={() => handleMethodSelect(method.id)}
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </>
            )}

            {/* Step 2: API Key (only for production methods) */}
            {currentStepId === "api_key" && (
              <>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Generate Your API Key
                  </CardTitle>
                  <CardDescription>
                    API keys authenticate your scans. Create one to get started with {selectedMethod === "cli" ? "the CLI" : selectedMethod === "mcp" ? "MCP Server" : selectedMethod === "github" ? "GitHub Actions" : "the API"}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {hasExistingKey && !generatedKey && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                      <div className="flex items-center gap-2 text-green-800">
                        <Check className="h-5 w-5" />
                        <span className="font-medium">You already have an API key!</span>
                      </div>
                      <p className="mt-1 text-sm text-green-700">
                        You can proceed to the next step, or generate a new key below.
                      </p>
                    </div>
                  )}

                  {!generatedKey ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="keyName">Key name (optional)</Label>
                        <Input
                          id="keyName"
                          placeholder="e.g., My First Key"
                          value={keyName}
                          onChange={(e) => setKeyName(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={handleGenerateKey}
                        disabled={loading}
                        className="w-full"
                      >
                        {loading ? "Generating..." : "Generate API Key"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                        <div className="flex items-center gap-2 text-green-800 mb-2">
                          <Sparkles className="h-5 w-5" />
                          <span className="font-medium">Your API key is ready!</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white rounded-md border border-green-300 p-2">
                          <code className="flex-1 text-sm font-mono text-gray-800 break-all">
                            {generatedKey}
                          </code>
                          <button
                            onClick={handleCopyKey}
                            className="p-1.5 rounded hover:bg-green-100 transition-colors"
                            title="Copy to clipboard"
                          >
                            {keyCopied ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4 text-green-700" />
                            )}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                          Copy this key now. For security, we can&apos;t show it again.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </>
            )}

            {/* Step 3: Get Started (only for production methods) */}
            {currentStepId === "get_started" && (
              <>
                <CardHeader>
                  <CardTitle>
                    Get Started with {selectedMethod === "cli" ? "CLI" : selectedMethod === "mcp" ? "MCP Server" : selectedMethod === "github" ? "GitHub Actions" : "API"}
                  </CardTitle>
                  <CardDescription>
                    Follow these steps to run your first scan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {selectedMethod === "cli" && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">1. Install the CLI</h4>
                        <CopyCommand
                          label="Requires Go 1.21+"
                          command="go install github.com/inkog-io/inkog/cmd/inkog@latest"
                          onCopy={() => handleCliCopy("go", "go install github.com/inkog-io/inkog/cmd/inkog@latest")}
                        />
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">2. Set your API key</h4>
                        <CopyCommand
                          command={`export INKOG_API_KEY="${displayApiKey}"`}
                          onCopy={() => handleCliCopy("go", `export INKOG_API_KEY="${displayApiKey}"`)}
                        />
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">3. Scan your agent</h4>
                        <CopyCommand
                          command="inkog scan ./my-agent"
                          onCopy={() => handleCliCopy("go", "inkog scan ./my-agent")}
                        />
                      </div>
                    </div>
                  )}

                  {selectedMethod === "mcp" && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">1. Add to Claude Desktop config</h4>
                        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                          <pre className="text-sm text-gray-100">{`{
  "mcpServers": {
    "inkog": {
      "command": "npx",
      "args": ["@inkog-io/mcp"],
      "env": {
        "INKOG_API_KEY": "${displayApiKey}"
      }
    }
  }
}`}</pre>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Config location: ~/Library/Application Support/Claude/claude_desktop_config.json
                        </p>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">2. Restart Claude Desktop</h4>
                        <p className="text-sm text-gray-600">
                          Quit and reopen Claude Desktop to load the Inkog MCP server.
                        </p>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">3. Ask Claude to scan</h4>
                        <CopyCommand
                          command="Scan my agent code for security vulnerabilities"
                          onCopy={() => handleCliCopy("source", "Scan my agent code")}
                        />
                      </div>
                    </div>
                  )}

                  {selectedMethod === "github" && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">1. Add secret to your repository</h4>
                        <p className="text-sm text-gray-600 mb-2">
                          Go to your repo → Settings → Secrets → Actions → New repository secret
                        </p>
                        <div className="bg-gray-100 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">Name:</span>
                            <code className="text-sm bg-white px-2 py-0.5 rounded border">INKOG_API_KEY</code>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">Value:</span>
                            <code className="text-sm bg-white px-2 py-0.5 rounded border font-mono">{displayApiKey}</code>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">2. Add workflow file</h4>
                        <CopyCommand
                          label="Create .github/workflows/inkog.yml"
                          command={`name: Inkog Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: inkog-io/action@v1
        with:
          api-key: \${{ secrets.INKOG_API_KEY }}`}
                          onCopy={() => handleCliCopy("source", "uses: inkog-io/action@v1")}
                        />
                      </div>
                    </div>
                  )}

                  {selectedMethod === "api" && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">1. Make an API request</h4>
                        <CopyCommand
                          label="Example cURL request"
                          command={`curl -X POST https://api.inkog.io/v1/scan \\
  -H "Authorization: Bearer ${displayApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"files": [{"path": "agent.py", "content": "..."}]}'`}
                          onCopy={() => handleCliCopy("source", "curl -X POST https://api.inkog.io/v1/scan")}
                        />
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">2. View documentation</h4>
                        <p className="text-sm text-gray-600">
                          See the{" "}
                          <a
                            href="https://docs.inkog.io/api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-900 underline hover:no-underline"
                          >
                            API documentation
                          </a>{" "}
                          for all endpoints and options.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </>
            )}
          </Card>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="gap-2"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleComplete} className="gap-2">
                Complete Setup
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
