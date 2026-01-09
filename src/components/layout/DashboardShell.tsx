"use client";

import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
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
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();

  return (
    <OrganizationProvider>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggle={toggleCollapsed}
          userEmail={userEmail}
          onCommandPaletteOpen={() => setCommandOpen(true)}
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
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Offline Banner */}
      <OfflineBanner />
    </OrganizationProvider>
  );
}
