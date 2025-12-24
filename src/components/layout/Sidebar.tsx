"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ChevronsLeft, ChevronsRight, Command } from "lucide-react";
import { SidebarNav } from "./SidebarNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  userEmail?: string;
  onCommandPaletteOpen?: () => void;
}

export function Sidebar({
  isCollapsed,
  onToggle,
  userEmail,
  onCommandPaletteOpen,
}: SidebarProps) {
  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-background border-r border-border flex flex-col z-30 transition-all duration-300",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "h-16 flex items-center border-b border-border px-4",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-sm">I</span>
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-lg text-foreground">Inkog</span>
            )}
          </Link>
        </div>

        {/* Command Palette Trigger */}
        {onCommandPaletteOpen && (
          <div className="px-3 pt-4">
            {isCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onCommandPaletteOpen}
                    className="w-full flex items-center justify-center p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                  >
                    <Command className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Search <kbd className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">Cmd K</kbd>
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={onCommandPaletteOpen}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-lg border border-border transition-colors"
              >
                <Command className="h-4 w-4" />
                <span className="flex-1 text-left">Search...</span>
                <kbd className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                  Cmd K
                </kbd>
              </button>
            )}
          </div>
        )}

        {/* Navigation */}
        <SidebarNav isCollapsed={isCollapsed} />

        {/* Collapse Toggle */}
        <div
          className="absolute top-1/2 -right-3 transform -translate-y-1/2 z-40"
          onDoubleClick={onToggle}
        >
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={onToggle}
                className="w-6 h-6 bg-background border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent shadow-sm transition-colors"
              >
                {isCollapsed ? (
                  <ChevronsRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronsLeft className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Theme Toggle */}
        <div className={cn(
          "px-3 py-2",
          isCollapsed ? "flex justify-center" : ""
        )}>
          {!isCollapsed ? (
            <ThemeToggle />
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div><ThemeToggle /></div>
              </TooltipTrigger>
              <TooltipContent side="right">Toggle theme</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* User Section */}
        <div className={cn(
          "p-4 border-t border-border",
          isCollapsed ? "flex justify-center" : "flex items-center gap-3"
        )}>
          <UserButton afterSignOutUrl="/" />
          {!isCollapsed && userEmail && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {userEmail.split("@")[0]}
              </p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
