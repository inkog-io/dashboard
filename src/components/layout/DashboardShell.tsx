"use client";

import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: React.ReactNode;
  userEmail?: string;
}

export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  const { isCollapsed, toggleCollapsed } = useSidebarState();

  return (
    <OrganizationProvider>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggle={toggleCollapsed}
          userEmail={userEmail}
        />
      </div>

      {/* Mobile Navigation */}
      <MobileNav userEmail={userEmail} />

      {/* Main Content */}
      <main
        className={cn(
          "min-h-screen bg-muted transition-all duration-300",
          // Desktop: offset by sidebar width
          isCollapsed ? "lg:pl-16" : "lg:pl-60",
          // Mobile: offset by top header
          "pt-16 lg:pt-0"
        )}
      >
        <div className="p-6 lg:p-8 max-w-[1440px] mx-auto">
          {children}
        </div>
      </main>

      {/* Offline Banner */}
      <OfflineBanner />
    </OrganizationProvider>
  );
}
