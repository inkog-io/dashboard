"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shield,
  Key,
  History,
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

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

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
      // Suppressions removed - requires Organizations feature (coming soon)
      { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
    ],
  },
];

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
        "hover:bg-gray-100",
        isActive
          ? "bg-gray-100 text-gray-900 border-l-2 border-gray-900 -ml-[2px] pl-[14px]"
          : "text-gray-600",
        isCollapsed && "justify-center px-2"
      )}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-gray-900")} />
      {!isCollapsed && <span>{item.label}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

export function SidebarNav({ isCollapsed }: SidebarNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider>
      <nav className="flex-1 px-3 py-4 space-y-6">
        {navGroups.map((group, groupIndex) => (
          <div key={group.title}>
            {groupIndex > 0 && <Separator className="mb-4" />}
            {!isCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
