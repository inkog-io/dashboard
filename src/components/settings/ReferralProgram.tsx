"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Copy, Check, Gift, Phone, Headphones, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY_CODE = "inkog_referral_code";
const STORAGE_KEY_COUNT = "inkog_referral_count";

const REWARD_TIERS = [
  {
    referrals: 1,
    label: "Inkog Red",
    description: "Early access to advanced detection",
    icon: Sparkles,
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-900/20",
  },
  {
    referrals: 3,
    label: "1:1 Onboarding Call",
    description: "Personal session with the Inkog team",
    icon: Phone,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    referrals: 5,
    label: "Priority Support",
    description: "Custom policy config + priority queue",
    icon: Headphones,
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
  },
];

function generateCode(userId: string): string {
  // Deterministic short code from user ID
  try {
    return btoa(userId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

export function ReferralProgram() {
  const { user } = useUser();
  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    // Get or generate referral code
    let code = localStorage.getItem(STORAGE_KEY_CODE);
    if (!code) {
      code = generateCode(user.id);
      localStorage.setItem(STORAGE_KEY_CODE, code);
    }
    setReferralCode(code);

    // Get referral count (MVP: display-only from localStorage)
    const count = parseInt(localStorage.getItem(STORAGE_KEY_COUNT) || "0", 10);
    setReferralCount(count);
  }, [user?.id]);

  const referralLink = referralCode
    ? `https://app.inkog.io/sign-up?ref=${referralCode}`
    : "";

  const handleCopy = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Find the next tier to unlock
  const nextTier = REWARD_TIERS.find((t) => referralCount < t.referrals);
  const progress = nextTier
    ? (referralCount / nextTier.referrals) * 100
    : 100;

  return (
    <div className="space-y-6">
      {/* Referral Link */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">
              Protect More Teams
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Share Inkog with colleagues. They get extended access, you unlock rewards.
            </p>

            {/* Referral link */}
            <div className="flex items-center gap-2 mt-4">
              <div className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 font-mono text-xs text-muted-foreground truncate">
                {referralLink || "Loading..."}
              </div>
              <button
                onClick={handleCopy}
                disabled={!referralLink}
                className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
              <div>
                <span className="text-lg font-bold text-foreground">{referralCount}</span>
                <span className="text-xs text-muted-foreground ml-1.5">referred</span>
              </div>
              {nextTier && (
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Next: {nextTier.label}</span>
                    <span>{referralCount}/{nextTier.referrals}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full">
                    <div
                      className="h-1.5 bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reward Tiers */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Reward Tiers</h3>
        <div className="flex flex-col gap-3">
          {REWARD_TIERS.map((tier) => {
            const Icon = tier.icon;
            const unlocked = referralCount >= tier.referrals;
            return (
              <div
                key={tier.referrals}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  unlocked
                    ? "border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-900/10"
                    : "border-border"
                )}
              >
                <div className={cn("p-2 rounded-lg", tier.bgColor)}>
                  <Icon className={cn("h-4 w-4", tier.color)} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {tier.label}
                    </span>
                    {unlocked && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-green-600 text-white rounded">
                        Unlocked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{tier.description}</p>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {tier.referrals} referral{tier.referrals > 1 ? "s" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
