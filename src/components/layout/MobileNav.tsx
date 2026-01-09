"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Menu, LayoutDashboard, Shield, Key, History, BookOpen } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/scan", label: "Scan", icon: Shield },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
  { href: "/dashboard/onboarding", label: "Setup Guide", icon: BookOpen },
];

interface MobileNavProps {
  userEmail?: string;
}

export function MobileNav({ userEmail }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-background border-b border-border z-40 flex items-center justify-between px-4">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">I</span>
        </div>
        <span className="font-semibold text-lg">Inkog</span>
      </Link>

      <div className="flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="p-2 hover:bg-muted rounded-lg transition-colors">
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0">
            <SheetHeader className="p-4 border-b border-border">
              <SheetTitle className="text-left">Navigation</SheetTitle>
            </SheetHeader>

            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {userEmail && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-muted">
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
