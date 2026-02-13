"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shield,
  Key,
  History,
  BookOpen,
  Github,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useApiKeyStatus } from "@/hooks/useApiKeyStatus";
import { useGitHubInstallationStatus } from "@/hooks/useGitHubInstallationStatus";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SidebarNavProps {
  isCollapsed: boolean;
}

function NavItemComponent({
  item,
  isCollapsed,
  isActive,
}: {
  item: NavItem;
  isCollapsed: boolean;
  isActive: boolean;
}) {
  const Icon = item.icon;

  const linkContent = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
        "hover:bg-muted",
        isActive
          ? "bg-muted text-foreground border-l-2 border-foreground -ml-[2px] pl-[14px]"
          : "text-muted-foreground",
        isCollapsed && "justify-center px-2"
      )}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-foreground")} />
      {!isCollapsed && (
        <span className="flex items-center gap-2">
          {item.label}
          {item.badge && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
              {item.badge}
            </span>
          )}
        </span>
      )}
      {isCollapsed && item.badge && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500" />
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div className="relative">{linkContent}</div>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          <span className="flex items-center gap-2">
            {item.label}
            {item.badge && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                {item.badge}
              </span>
            )}
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

export function SidebarNav({ isCollapsed }: SidebarNavProps) {
  const pathname = usePathname();
  const { hasKeys, loading: loadingKeys } = useApiKeyStatus();
  const { hasInstallations, loading: loadingInstallations } = useGitHubInstallationStatus();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  // Build nav groups dynamically to include badges
  const navGroups: NavGroup[] = [
    {
      title: "SECURITY",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/dashboard/scan", label: "Scan", icon: Shield },
        { href: "/dashboard/history", label: "History", icon: History },
      ],
    },
    {
      title: "SETTINGS",
      items: [
        {
          href: "/dashboard/api-keys",
          label: "API Keys",
          icon: Key,
          // Show badge only when we know user has no keys (not loading)
          badge: !loadingKeys && !hasKeys ? "Setup" : undefined,
        },
        {
          href: "/dashboard/integrations",
          label: "Integrations",
          icon: Github,
          badge: !loadingInstallations && !hasInstallations ? "Setup" : undefined,
        },
      ],
    },
    {
      title: "HELP",
      items: [
        { href: "/dashboard/onboarding", label: "Setup Guide", icon: BookOpen },
      ],
    },
  ];

  return (
    <TooltipProvider>
      <nav className="flex-1 px-3 py-4 space-y-6">
        {navGroups.map((group, groupIndex) => (
          <div key={group.title}>
            {groupIndex > 0 && <Separator className="mb-4" />}
            {!isCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </h3>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItemComponent
                  key={item.href}
                  item={item}
                  isCollapsed={isCollapsed}
                  isActive={isActive(item.href)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </TooltipProvider>
  );
}
