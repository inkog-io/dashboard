"use client";

import { useState, useEffect } from "react";
import { Shield, ExternalLink, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "inkog_linkedin_followed";
const LINKEDIN_URL = "https://www.linkedin.com/company/inkog/";

export function LinkedInGate() {
  const [followed, setFollowed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setFollowed(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const handleFollow = () => {
    window.open(LINKEDIN_URL, "_blank", "noopener,noreferrer");
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setFollowed(true);
  };

  if (followed) {
    return (
      <div className="bg-card border border-green-200 dark:border-green-800/40 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-green-100 dark:bg-green-900/30">
            <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Inkog Red</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white rounded">
                Active
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              You have early access to Inkog Red features — advanced detection rules and deeper behavioral analysis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">Unlock Inkog Red</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Follow Inkog on LinkedIn to get early access to advanced security features, including deeper behavioral analysis and custom detection rules.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleFollow}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0A66C2] text-white text-sm font-medium rounded-lg hover:bg-[#004182] transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Follow on LinkedIn
            </button>
            {showConfirm && (
              <button
                onClick={handleConfirm}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors"
              >
                <Check className="h-4 w-4" />
                I&apos;ve followed
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
