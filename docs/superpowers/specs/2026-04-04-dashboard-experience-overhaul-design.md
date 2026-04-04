# Dashboard Experience Overhaul — Design Spec

**Date:** 2026-04-04
**Status:** Draft
**Approach:** Hero Journey — empowerment-first UX inspired by cubic.dev and Wiz

## Context

Inkog needs to land its first customers. The dashboard is already functional but needs to feel premium, guide users to automation fast, and create organic growth loops. Pricing exists but isn't enforced yet — this creates a window to use feature-gating as a growth tool.

**Core insight:** Security teams want to be heroes, not gatekeepers. Every dashboard surface should reinforce that the user is protecting their org's AI stack, not just flagging problems.

**Strategic framing:** The dashboard is the lobby, not the product. Automation (CI/CD, GitHub, MCP) is the product. The dashboard should get users to automation in <10 minutes and provide a clean summary view for check-ins and compliance reporting.

## Scope

### 7 Net-New Items

1. **Setup checklist component** — persistent, auto-completing, with time estimates
2. **Dashboard metrics reframe** — empowerment language + trend indicators
3. **Activity feed** — recent scans/actions timeline
4. **Referral program UI** — referral links, reward tiers, stats
5. **LinkedIn-gated Inkog Red** — honor system follow-to-unlock
6. **Shareable security badges** — embeddable SVGs for README
7. **Onboarding flow refactor** — remove redirect, checklist replaces wizard

### Already Built (No Work Needed)

- Export from dashboard (JSON/SARIF/PDF) — `src/lib/export-utils.ts`, used in results and skills pages
- Dashboard URL scan for Skills/MCP — `repoUrl` state in `scan/page.tsx`
- GitHub App integration — install flow + auto-scan working
- Multi-platform CI/CD templates — GitHub Actions, GitLab, Azure DevOps, Jenkins (PR #12)

### Out of Scope

- Backend API changes
- Webhook/Slack notifications
- Scheduled recurring scans
- Billing enforcement
- Azure/GitLab dashboard integration
- Mobile-specific redesign

---

## 1. Setup Checklist Component

### What It Replaces

Current flow: New users are redirected from `/dashboard` to `/dashboard/onboarding` by `ActivationGuard`. A 3-step wizard (choose method → API key → get started) runs once and is never seen again.

### New Flow

New users land on the real dashboard immediately. A persistent setup checklist is visible as a banner at the top of the dashboard page. No redirect. No separate onboarding page.

### Steps (auto-completing)

| # | Step | Time | Auto-complete condition | Action |
|---|------|------|------------------------|--------|
| 1 | Create account | — | Always complete (they're signed in) | — |
| 2 | Generate API key | ~1 min | `api.keys.list()` returns ≥1 key | Link to settings/API keys |
| 3 | Connect GitHub | ~3 min | `api.github.getInstallations()` returns ≥1 | GitHub App install flow (pushed before scan to establish CI/CD-first workflow) |
| 4 | Run first scan | ~2 min | `api.history.list()` returns ≥1 scan | Offers: Upload, CLI command, GitHub URL |
| 5 | Review findings | ~1 min | User has visited any `/dashboard/results/[id]` page | Link to latest scan results |

### Component: `SetupChecklist`

**Location:** `src/components/dashboard/SetupChecklist.tsx`

**Rendering:** Two variants:
- **Banner** (horizontal) — shown at top of dashboard page for new users
- **Sidebar widget** — optional, shown in sidebar below navigation

**State management:**
- Completion state derived from API calls (keys, scans, GitHub installations) — same data the dashboard already fetches
- Step 5 (review findings) tracked via localStorage flag `inkog_reviewed_findings`
- Dismissed state stored in Clerk user metadata: `user.publicMetadata.setup_dismissed`
- Once all 5 steps complete OR user dismisses, the checklist never renders again

**Behavior:**
- Each pending step has a "Start →" link that either navigates or expands inline instructions
- Steps 2-4 offer method-specific instructions (CLI commands, MCP config, GitHub Actions YAML) — reusing content from the existing onboarding page
- Progress bar shows fraction complete (e.g., "3 of 5")
- PostHog events: `setup_step_completed`, `setup_checklist_dismissed`, `setup_checklist_completed`

### Files Modified

- `src/components/dashboard/SetupChecklist.tsx` — **new** component
- `src/app/dashboard/page.tsx` — render `SetupChecklist` above metrics when setup incomplete
- `src/components/ActivationGuard.tsx` — remove redirect to `/dashboard/onboarding`, keep component but make it a no-op (or remove entirely)
- `src/app/dashboard/onboarding/page.tsx` — keep as a deep-link fallback but no longer the primary flow

---

## 2. Dashboard Metrics Reframe

### Language Changes

| Current | New | Rationale |
|---------|-----|-----------|
| "Assets Monitored" | "Agents Secured" | Empowerment: you're protecting, not surveilling |
| "Critical Issues: 5" | "Risks Caught: 23" with "4 critical" badge | Hero framing: you caught them |
| "Governance Score" | "Security Posture: 82/100" | Authoritative, Wiz-style |
| "Avg Risk Score" | "Compliance" with framework badges | Concrete value for auditors |

### Trend Indicators

Each metric card shows a delta vs last scan: "↑ 7 vs last scan" in green or "↓ 3" in amber. Requires comparing current stats against previous scan stats — data already available from `api.history.list()`.

### Hero Metric

"Security Posture" card gets a subtle gradient top-border (green→blue) to visually anchor it as the primary metric.

### Subtitle on Risks Caught

"Before they reached production" — reinforces the hero narrative. Only shown when user has ≥1 scan with findings.

### Files Modified

- `src/app/dashboard/page.tsx` — update metrics grid labels, add trend calculation
- `src/components/dashboard/SecurityMetricCard.tsx` — add optional `trend` prop and delta display

---

## 3. Activity Feed

### What It Is

A timeline of recent events shown in the right column of the dashboard (below metrics, alongside the agents table). Shows scan completions, GitHub connections, finding resolutions, MCP scans.

### Data Source

Derived from existing API data:
- `api.history.list()` — recent scans (already fetched on dashboard)
- `api.agents.list()` — agent status changes
- `api.github.getInstallations()` — connection events
- `api.skills.listScans()` — skill/MCP scan results (already fetched)

### Event Types

| Event | Color | Source |
|-------|-------|--------|
| Scan completed | Blue | history list |
| Finding resolved/suppressed | Green | suppressions |
| GitHub connected | Purple | installations |
| MCP/Skill scanned | Amber | skills list |

### Component: `ActivityFeed`

**Location:** `src/components/dashboard/ActivityFeed.tsx`

Shows most recent 5-8 events. Each event: colored left-border + title + subtitle with agent name + relative time. No pagination — this is a glanceable summary.

### Layout Change

Dashboard shifts from single-column to **2-column below metrics**: agents table (2fr) + activity feed (1fr). On mobile, activity feed stacks below agents.

### Files Modified

- `src/components/dashboard/ActivityFeed.tsx` — **new** component
- `src/app/dashboard/page.tsx` — add ActivityFeed in 2-column grid layout

---

## 4. Referral Program UI

### How It Works

- Each user gets a unique referral code stored in Clerk `user.publicMetadata.referral_code` (generated on first visit to referral page)
- Referral link format: `https://app.inkog.io/sign-up?ref=<code>`
- When a referred user signs up, Clerk `user.unsafeMetadata.referred_by` stores the referrer's code
- Referral count tracking: For MVP, the referral page queries all users' `unsafeMetadata.referred_by` matching the current user's code. This is not scalable past ~100 users but works for launch. Future: Clerk webhook on `user.created` increments the referrer's `publicMetadata.referral_count`

### Reward Tiers

| Referrals | Reward |
|-----------|--------|
| 1 | Unlock Inkog Red beta access |
| 3 | 1:1 onboarding call with the Inkog team |
| 5 | Priority support + custom policy configuration |

The 1:1 onboarding call is the highest-value reward — it builds a personal relationship with early users, gives you direct feedback, and makes the referrer feel like a VIP. This is what converts early adopters into champions.

### Where It Lives

New section in settings page (`/dashboard/settings`) or a dedicated `/dashboard/referrals` page. Contains:
- Referral link with copy button
- Reward tiers with progress indicators
- Stats: referred count, signed-up count, current reward tier

### Component: `ReferralProgram`

**Location:** `src/components/settings/ReferralProgram.tsx`

### Note on Backend

For MVP: store all referral state in Clerk metadata. No backend API needed. When referral tracking needs to be more robust (attribution, deduplication), add a `/v1/referrals` backend endpoint.

### Files Modified

- `src/components/settings/ReferralProgram.tsx` — **new** component
- `src/app/dashboard/settings/page.tsx` — add ReferralProgram section
- `src/app/sign-up/[[...sign-up]]/page.tsx` — capture `ref` query param into Clerk metadata on signup

---

## 5. LinkedIn-Gated Inkog Red

### How It Works

1. User sees "Unlock Inkog Red" card in dashboard (settings page or dashboard sidebar)
2. Card shows: "Follow Inkog on LinkedIn to get early access to Inkog Red"
3. "Follow on LinkedIn" button opens `https://www.linkedin.com/company/inkog/` in new tab
4. "I've followed" button sets `user.publicMetadata.linkedin_followed = true` and `linkedin_followed_at = timestamp`
5. Inkog Red features become available immediately

### What Inkog Red Unlocks

This is a product decision — placeholder options:
- Advanced detection rules
- Deep scan access
- Priority scan queue
- Custom policy builder

### Anti-Gaming

Honor system — no verification. Acceptable because:
- The goal is LinkedIn traffic/followers, not strict gating
- Users who game it still signed up and are using the product
- Cubic uses this exact pattern successfully

### Component: `LinkedInGate`

**Location:** `src/components/settings/LinkedInGate.tsx`

Small card component. Shows locked state → follow CTA → unlocked state with "Inkog Red" badge.

### Files Modified

- `src/components/settings/LinkedInGate.tsx` — **new** component
- `src/app/dashboard/settings/page.tsx` — add LinkedInGate card
- `src/hooks/useCurrentUser.ts` — add `hasInkogRed` boolean derived from Clerk metadata

---

## 6. Shareable Security Badges

### What They Are

SVG badges similar to shields.io format that users can embed in their GitHub README:

```
[secured by inkog | A+]
[EU AI Act | compliant]
[OWASP LLM Top 10 | 8/10 covered]
```

### How They Work

- Badge URL format: `https://app.inkog.io/api/badge/<agent-id>?type=posture` (or `compliance`, `owasp`)
- API route returns SVG with dynamic values based on latest scan results
- Requires the agent to have at least one completed scan
- Badge data is public (read-only, no auth needed) — this is intentional for README embedding

### Badge Types (Snyk/Wiz-style)

| Type | Example | Data Source |
|------|---------|-------------|
| `criticals` | "Inkog \| 0 Criticals" (green) or "Inkog \| 3 Criticals" (red) | Critical finding count from latest scan |
| `secured` | "Inkog \| Secured" (green) | Static — no data dependency, just signals repo is scanned |

### Where Users Get Badges

"Badges" section on the agent results page (`/dashboard/results/[id]`) or in settings. Shows preview + markdown snippet to copy.

### Files Modified

- `src/app/api/badge/[agentId]/route.ts` — **new** API route returning SVG
- `src/components/BadgeGenerator.tsx` — **new** component with preview + copy markdown
- `src/app/dashboard/results/[id]/page.tsx` — add BadgeGenerator section

---

## 7. Onboarding Flow Refactor

### What Changes

- **Remove:** ActivationGuard redirect to `/dashboard/onboarding`
- **Keep:** `/dashboard/onboarding` page as a deep-link (for users who bookmarked it or arrive from docs)
- **Add:** SetupChecklist renders on dashboard when setup is incomplete (item 1 above)
- **Update:** Welcome banner logic — show "Welcome to Inkog" with checklist instead of separate green banner

### Migration

- Existing users (already activated) see no change — checklist never renders for them
- New users see the dashboard immediately with the checklist banner
- PostHog events for onboarding still fire, just from the checklist component instead of the onboarding page

### Files Modified

- `src/components/ActivationGuard.tsx` — remove redirect logic (component becomes passthrough)
- `src/app/dashboard/page.tsx` — remove old welcome banner, replace with SetupChecklist
- `src/app/dashboard/layout.tsx` — remove ActivationGuard wrapper (or make it a no-op)

---

## Design Principles

1. **Professional, not playful** — Wiz-level authority, not gamification. Time estimates build trust, not badges or confetti.
2. **Additive, not destructive** — Every change builds on existing components. No rewrites. Existing features remain intact.
3. **Data-driven completion** — Setup steps auto-complete from API state. No manual "mark as done" (except LinkedIn follow).
4. **Clerk as the metadata store** — Referral codes, LinkedIn gate, setup dismissal all stored in Clerk user metadata. Zero backend changes.
5. **Ship incrementally, release as one** — Build and validate each item independently, but release together as a cohesive update.

---

## Verification Plan

### Manual Testing

1. **New user flow:** Create a new Clerk test user → verify checklist appears → complete each step → verify auto-completion → verify dismissal persists
2. **Returning user flow:** Existing user with scans → verify checklist does NOT appear → verify metrics show new language + trends
3. **Referral flow:** Copy referral link → sign up with ref param → verify referred_by stored → verify referrer count increments
4. **LinkedIn gate:** Click follow → click "I've followed" → verify Inkog Red state persists across sessions
5. **Badges:** Visit badge URL → verify SVG renders with correct data → embed in markdown → verify renders in GitHub
6. **Activity feed:** Run multiple scans → verify feed shows events in correct order with correct types

### Automated Tests

- `SetupChecklist` — render with various completion states, test auto-complete logic, test dismiss
- `ActivityFeed` — render with mock events, test empty state
- `ReferralProgram` — render with various referral counts, test copy link
- `LinkedInGate` — render locked/unlocked states
- `BadgeGenerator` — render with mock agent data, test markdown copy
- Badge API route — test SVG generation with various scores

### Build Verification

```bash
npm run build    # Ensure no TypeScript errors
npm run lint     # Ensure no ESLint violations
npm test         # Run all tests including new ones
```

### PostHog Events to Verify

- `setup_step_completed` (step_name, step_number, method)
- `setup_checklist_dismissed`
- `setup_checklist_completed` (duration_seconds, steps_completed)
- `referral_link_copied`
- `linkedin_gate_completed`
- `badge_copied` (badge_type, agent_id)
