"use client";

interface ActivationGuardProps {
  children: React.ReactNode;
}

/**
 * ActivationGuard - Previously redirected new users to /dashboard/onboarding.
 * Now a passthrough — the setup checklist on the dashboard page handles onboarding.
 * Kept as a component to preserve imports in layout.tsx and other consumers.
 */
export function ActivationGuard({ children }: ActivationGuardProps) {
  return <>{children}</>;
}
