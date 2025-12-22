"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ChevronsLeft, ChevronsRight, Command } from "lucide-react";
import { SidebarNav } from "./SidebarNav";
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
          "fixed left-0 top-0 h-full bg-white border-r border-gray-200 flex flex-col z-30 transition-all duration-300",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "h-16 flex items-center border-b border-gray-100 px-4",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">I</span>
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-lg text-gray-900">Inkog</span>
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
                    className="w-full flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Command className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Search <kbd className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded">Cmd K</kbd>
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={onCommandPaletteOpen}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
              >
                <Command className="h-4 w-4" />
                <span className="flex-1 text-left">Search...</span>
                <kbd className="text-xs text-gray-400 bg-white px-1.5 py-0.5 rounded border">
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
                className="w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
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

        {/* User Section */}
        <div className={cn(
          "p-4 border-t border-gray-100",
          isCollapsed ? "flex justify-center" : "flex items-center gap-3"
        )}>
          <UserButton afterSignOutUrl="/" />
          {!isCollapsed && userEmail && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userEmail.split("@")[0]}
              </p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
