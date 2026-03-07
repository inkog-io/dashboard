"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { Settings, Key, Github, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { APIKeysSection } from "@/components/settings/APIKeysSection";
import { IntegrationsSection } from "@/components/settings/IntegrationsSection";
import { AdminSection } from "@/components/settings/AdminSection";

type Tab = "api-keys" | "integrations" | "team";

const tabs: { id: Tab; label: string; icon: typeof Key; adminOnly?: boolean }[] = [
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "integrations", label: "Integrations", icon: Github },
  { id: "team", label: "Team", icon: Users, adminOnly: true },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAdmin } = useCurrentUser();

  const activeTab = (searchParams.get("tab") as Tab) || "api-keys";

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  const setTab = (tab: Tab) => {
    router.push(`/dashboard/settings?tab=${tab}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage API keys, integrations, and team members.{" "}
          <a href="https://docs.inkog.io/api" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground/60 hover:text-primary transition-colors">
            Docs &rarr;
          </a>
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "api-keys" && <APIKeysSection />}
        {activeTab === "integrations" && <IntegrationsSection />}
        {activeTab === "team" && isAdmin && <AdminSection />}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-foreground border-t-transparent" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
