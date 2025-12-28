"use client";

import React from "react";
import { Building2, Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OrgSwitcherProps {
  isCollapsed?: boolean;
}

const roleColors: Record<string, string> = {
  owner: "text-amber-500",
  admin: "text-blue-500",
  member: "text-muted-foreground",
};

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function OrgSwitcher({ isCollapsed = false }: OrgSwitcherProps) {
  const {
    currentOrg,
    organizations,
    setCurrentOrg,
    isLoading,
    isPersonalWorkspace,
  } = useOrganization();

  // Don't show if no organizations
  if (!isLoading && organizations.length === 0) {
    return null;
  }

  const trigger = (
    <button
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-background p-2 text-sm transition-colors hover:bg-accent",
        isCollapsed ? "w-10 justify-center" : "w-full"
      )}
      disabled={isLoading}
    >
      {isLoading ? (
        <div className="h-5 w-5 animate-pulse rounded bg-muted" />
      ) : (
        <>
          {isPersonalWorkspace ? (
            <User className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Building2 className="h-5 w-5 text-primary" />
          )}
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate text-left">
                {isPersonalWorkspace ? "Personal" : currentOrg?.name}
              </span>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </>
          )}
        </>
      )}
    </button>
  );

  const content = (
    <DropdownMenuContent align="start" className="w-56">
      <DropdownMenuLabel>Organizations</DropdownMenuLabel>
      <DropdownMenuSeparator />

      {/* Personal Workspace option */}
      <DropdownMenuItem
        onClick={() => setCurrentOrg(null)}
        className="flex items-center gap-2"
      >
        <User className="h-4 w-4" />
        <span className="flex-1">Personal Workspace</span>
        {isPersonalWorkspace && <Check className="h-4 w-4 text-primary" />}
      </DropdownMenuItem>

      {organizations.length > 0 && <DropdownMenuSeparator />}

      {/* Organization list */}
      {organizations.map((org) => (
        <DropdownMenuItem
          key={org.id}
          onClick={() => setCurrentOrg(org)}
          className="flex items-center gap-2"
        >
          <Building2 className="h-4 w-4" />
          <div className="flex flex-1 flex-col">
            <span className="truncate">{org.name}</span>
            <span className={cn("text-xs", roleColors[org.role] || "text-muted-foreground")}>
              {roleLabels[org.role] || org.role}
            </span>
          </div>
          {currentOrg?.id === org.id && (
            <Check className="h-4 w-4 text-primary" />
          )}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );

  if (isCollapsed) {
    return (
      <DropdownMenu>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isPersonalWorkspace ? "Personal Workspace" : currentOrg?.name}
          </TooltipContent>
        </Tooltip>
        {content}
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      {content}
    </DropdownMenu>
  );
}
