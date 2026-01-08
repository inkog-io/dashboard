/**
 * PostHog Analytics Types and Utilities
 *
 * Defines typed events for tracking user behavior through the onboarding funnel
 * and other key product interactions.
 */

import { posthog } from "@/components/PostHogProvider";

// =============================================================================
// Event Type Definitions
// =============================================================================

/** Scan methods available in onboarding */
export type ScanMethod = "cli" | "mcp" | "upload" | "github" | "api" | "quick-demo";

/** CLI installation methods */
export type CliInstallMethod = "brew" | "go" | "docker" | "source";

/** Onboarding step identifiers */
export type OnboardingStep = "api_key" | "scan_method" | "get_started" | "first_scan";

// =============================================================================
// Event Properties Interfaces
// =============================================================================

export interface OnboardingStartedProperties {
  referrer?: string;
  first_visit?: boolean;
}

export interface ScanMethodSelectedProperties {
  method: ScanMethod;
  step: OnboardingStep;
}

export interface CliCommandCopiedProperties {
  command_type: CliInstallMethod;
  step: OnboardingStep;
  command: string;
}

export interface FirstScanAttemptedProperties {
  method: ScanMethod;
  from_onboarding: boolean;
}

export interface OnboardingCompletedProperties {
  duration_seconds: number;
  steps_completed: number;
  scan_method_chosen: ScanMethod;
}

export interface OnboardingSkippedProperties {
  skipped_at_step: OnboardingStep;
  steps_completed: number;
}

export interface ApiKeyCreatedProperties {
  key_name: string;
  from_onboarding?: boolean;
}

// =============================================================================
// Analytics Helper Functions
// =============================================================================

/**
 * Track when a user starts the onboarding flow
 */
export function trackOnboardingStarted(properties?: OnboardingStartedProperties): void {
  posthog.capture("onboarding_started", {
    timestamp: new Date().toISOString(),
    ...properties,
  });
}

/**
 * Track when a user selects a scan method in onboarding
 */
export function trackScanMethodSelected(properties: ScanMethodSelectedProperties): void {
  posthog.capture("scan_method_selected", properties);
}

/**
 * Track when a user copies a CLI command
 */
export function trackCliCommandCopied(properties: CliCommandCopiedProperties): void {
  posthog.capture("cli_command_copied", properties);
}

/**
 * Track when a user attempts their first scan
 */
export function trackFirstScanAttempted(properties: FirstScanAttemptedProperties): void {
  posthog.capture("first_scan_attempted", properties);
}

/**
 * Track when a user completes the onboarding flow
 */
export function trackOnboardingCompleted(properties: OnboardingCompletedProperties): void {
  posthog.capture("onboarding_completed", properties);
}

/**
 * Track when a user skips onboarding
 */
export function trackOnboardingSkipped(properties: OnboardingSkippedProperties): void {
  posthog.capture("onboarding_skipped", properties);
}

/**
 * Track when an API key is created (enhanced with onboarding context)
 */
export function trackApiKeyCreated(properties: ApiKeyCreatedProperties): void {
  posthog.capture("api_key_created", properties);
}

// =============================================================================
// Onboarding State Management
// =============================================================================

const ONBOARDING_STORAGE_KEY = "inkog_onboarding_state";

export interface OnboardingState {
  startedAt: string;
  currentStep: OnboardingStep;
  stepsCompleted: OnboardingStep[];
  apiKeyGenerated: boolean;
  scanMethodChosen: ScanMethod | null;
  hasCompletedOnboarding: boolean;
  /** Clerk user ID - ensures onboarding state is per-user */
  userId?: string;
}

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  startedAt: "",
  currentStep: "api_key",
  stepsCompleted: [],
  apiKeyGenerated: false,
  scanMethodChosen: null,
  hasCompletedOnboarding: false,
  userId: undefined,
};

/**
 * Get the current onboarding state from localStorage
 */
export function getOnboardingState(): OnboardingState {
  if (typeof window === "undefined") {
    return DEFAULT_ONBOARDING_STATE;
  }

  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as OnboardingState;
    }
  } catch {
    // Invalid stored state, return default
  }

  return DEFAULT_ONBOARDING_STATE;
}

/**
 * Save onboarding state to localStorage
 */
export function saveOnboardingState(state: Partial<OnboardingState>): void {
  if (typeof window === "undefined") return;

  const currentState = getOnboardingState();
  const newState = { ...currentState, ...state };

  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(newState));
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Mark onboarding as started
 */
export function startOnboarding(): void {
  const state = getOnboardingState();
  if (!state.startedAt) {
    saveOnboardingState({
      startedAt: new Date().toISOString(),
      currentStep: "api_key",
    });
    trackOnboardingStarted({
      first_visit: true,
    });
  }
}

/**
 * Mark a step as completed and advance to the next
 */
export function completeOnboardingStep(step: OnboardingStep): void {
  const state = getOnboardingState();
  const stepsCompleted = [...state.stepsCompleted];

  if (!stepsCompleted.includes(step)) {
    stepsCompleted.push(step);
  }

  const nextStep = getNextStep(step);

  saveOnboardingState({
    stepsCompleted,
    currentStep: nextStep,
  });
}

/**
 * Get the next step after the current one
 */
function getNextStep(currentStep: OnboardingStep): OnboardingStep {
  switch (currentStep) {
    case "api_key":
      return "scan_method";
    case "scan_method":
      return "first_scan";
    case "first_scan":
      return "first_scan"; // Last step
    default:
      return "api_key";
  }
}

/**
 * Calculate onboarding duration in seconds
 */
export function getOnboardingDuration(): number {
  const state = getOnboardingState();
  if (!state.startedAt) return 0;

  const startTime = new Date(state.startedAt).getTime();
  const endTime = Date.now();

  return Math.round((endTime - startTime) / 1000);
}

/**
 * Mark onboarding as completed
 */
export function completeOnboarding(scanMethod: ScanMethod): void {
  const duration = getOnboardingDuration();
  const state = getOnboardingState();

  saveOnboardingState({
    hasCompletedOnboarding: true,
    scanMethodChosen: scanMethod,
  });

  trackOnboardingCompleted({
    duration_seconds: duration,
    steps_completed: state.stepsCompleted.length + 1,
    scan_method_chosen: scanMethod,
  });
}

/**
 * Skip onboarding
 */
export function skipOnboarding(): void {
  const state = getOnboardingState();

  saveOnboardingState({
    hasCompletedOnboarding: true,
  });

  trackOnboardingSkipped({
    skipped_at_step: state.currentStep,
    steps_completed: state.stepsCompleted.length,
  });
}

/**
 * Check if user has completed onboarding
 * @param userId - Optional Clerk user ID. If provided, verifies state belongs to this user.
 */
export function hasCompletedOnboarding(userId?: string): boolean {
  const state = getOnboardingState();

  // If no completion flag, not completed
  if (!state.hasCompletedOnboarding) {
    return false;
  }

  // If userId provided, verify state belongs to this user
  // This ensures different users on same device each see onboarding
  if (userId && state.userId && state.userId !== userId) {
    return false;
  }

  return true;
}

/**
 * Reset onboarding state (for testing)
 */
export function resetOnboarding(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}
