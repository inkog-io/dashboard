"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "@clerk/nextjs";
import {
  createAPIClient,
  Organization,
  OrgRole,
  InkogAPIError,
} from "@/lib/api";

// =============================================================================
// Types
// =============================================================================

interface OrganizationContextValue {
  // Current organization
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;

  // All organizations
  organizations: Organization[];
  isLoading: boolean;
  error: string | null;

  // Refresh organizations list
  refresh: () => Promise<void>;

  // Role checks for current org
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;

  // Personal workspace mode (no org selected)
  isPersonalWorkspace: boolean;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(
  undefined
);

// =============================================================================
// Storage helpers
// =============================================================================

const STORAGE_KEY = "inkog_current_org_id";

function getStoredOrgId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredOrgId(orgId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (orgId) {
      localStorage.setItem(STORAGE_KEY, orgId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

// =============================================================================
// Provider
// =============================================================================

interface OrganizationProviderProps {
  children: React.ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { getToken, isSignedIn } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create API client
  const api = useMemo(() => createAPIClient(getToken), [getToken]);

  // Fetch organizations
  const fetchOrganizations = useCallback(async () => {
    if (!isSignedIn) {
      setOrganizations([]);
      setCurrentOrgState(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.orgs.list();
      const orgs = response.organizations || [];
      setOrganizations(orgs);

      // Restore previously selected org or select first one
      const storedOrgId = getStoredOrgId();
      if (storedOrgId) {
        const storedOrg = orgs.find((o) => o.id === storedOrgId);
        if (storedOrg) {
          setCurrentOrgState(storedOrg);
        } else if (orgs.length > 0) {
          // Stored org no longer exists, select first
          setCurrentOrgState(orgs[0]);
          setStoredOrgId(orgs[0].id);
        }
      } else if (orgs.length > 0) {
        // No stored org, select first
        setCurrentOrgState(orgs[0]);
        setStoredOrgId(orgs[0].id);
      }
    } catch (err) {
      if (err instanceof InkogAPIError) {
        // 404 means no orgs endpoint (user might be on personal workspace)
        if (err.status === 404) {
          setOrganizations([]);
          setCurrentOrgState(null);
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to load organizations");
      }
    } finally {
      setIsLoading(false);
    }
  }, [api, isSignedIn]);

  // Set current org with persistence
  const setCurrentOrg = useCallback((org: Organization | null) => {
    setCurrentOrgState(org);
    setStoredOrgId(org?.id ?? null);
  }, []);

  // Initial load
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Compute role-based permissions
  const role: OrgRole | null = currentOrg?.role ?? null;
  const isOwner = role === "owner";
  const isAdmin = role === "admin" || role === "owner";
  const isMember = role === "member" || isAdmin;
  const canManageMembers = isAdmin;
  const canManageSettings = isAdmin;
  const isPersonalWorkspace = currentOrg === null;

  const value: OrganizationContextValue = useMemo(
    () => ({
      currentOrg,
      setCurrentOrg,
      organizations,
      isLoading,
      error,
      refresh: fetchOrganizations,
      isOwner,
      isAdmin,
      isMember,
      canManageMembers,
      canManageSettings,
      isPersonalWorkspace,
    }),
    [
      currentOrg,
      setCurrentOrg,
      organizations,
      isLoading,
      error,
      fetchOrganizations,
      isOwner,
      isAdmin,
      isMember,
      canManageMembers,
      canManageSettings,
      isPersonalWorkspace,
    ]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider"
    );
  }
  return context;
}
