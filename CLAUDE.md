# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

AI-powered account prioritisation tool for PE portfolio leadership. Built for the Tenzing AI Sherpa Programme technical challenge.

**Live**: https://tenzing-account-prioritiser.vercel.app

## Development Commands

```bash
npm run dev      # Start Next.js dev server (localhost:3000)
npm run build    # Production build (also runs type checking)
npm run lint     # ESLint (next/core-web-vitals + next/typescript)
npm start        # Start production server (requires build first)
```

No test framework is configured. Lint config: `.eslintrc.json` extends `next/core-web-vitals` and `next/typescript`.

## Tech Stack

- Next.js 14 (App Router, TypeScript) + Tailwind + shadcn/ui (base-ui variant) + Zustand (client state)
- Supabase (PostgreSQL + Auth with Google OAuth)
- Claude API (Anthropic SDK, model: `claude-sonnet-4-20250514`)
- ElevenLabs Conversational AI Agent (voice chat, feature-flagged)
- Vercel for deployment

## Architecture

**Two-phase prioritisation:**
1. **Deterministic scoring** (`lib/scoring/`) — transparent, auditable, no AI dependency
2. **AI contextual analysis** (`lib/ai/`) — Claude enriches scores with reasoning, actions, risks. Falls back to deterministic summary if API fails.

### Scoring Pipeline (9 steps in `lib/scoring/engine.ts`)

1. Calculate 5 sub-scores: Revenue, Engagement, Support, Opportunity, Urgency (all 0–100)
2. Compute health composite from first 4 sub-scores (urgency excluded)
3. Priority score = (100 − health) × 60% + urgency × 40%
4. Determine tier from raw score (critical ≥80, high ≥65, medium ≥50, low ≥35, monitor <35)
5. Apply critical overrides (e.g. renewal <45d + health <40 → critical)
6. Detect contradictions between signals (`contradictions.ts`)
7. Determine priority type (churn_risk, renewal_urgent, expansion_opportunity, mixed_signals, stable)
8. Apply tier floors (certain types guarantee minimum tier)
9. Calculate ARR factor (log-scaled, clamped 0.7–1.5)

All weights are in `lib/scoring/weights.ts`. Signal functions in `lib/scoring/signals.ts` are pure (no side effects, 0–100 normalised). Calibration (`calibration.ts`) rescales scores across the full portfolio using min-max normalisation.

**Reference date**: Scoring uses hardcoded `2026-03-17` for all date calculations.

### Data Flow: Analyse Endpoint

`POST /api/analyse-all` → Auth check → Fetch all accounts → `scoreAllAccounts()` → AI analysis in parallel batches of 5 → Upsert to `ai_analyses` → `generatePortfolioInsights()` → Upsert to `portfolio_insights`

### Auth Flow

- `middleware.ts` runs on `/dashboard/*`, `/accounts/*`, `/actions/*`, `/chat/*`, `/api/*`
- `lib/supabase/middleware.ts` refreshes Supabase session from cookies
- Unauthenticated users → redirect `/login`
- API routes must check `supabase.auth.getUser()` manually (not auto-injected in Next.js 14 SSR)

### API Timeouts

- `/api/analyse-all`: 300s (5 min)
- `/api/analyse`, `/api/chat`: 60s

## Key Files

| Area | Files |
|------|-------|
| Scoring engine | `lib/scoring/engine.ts`, `weights.ts`, `signals.ts`, `contradictions.ts`, `calibration.ts` |
| AI prompts & analysis | `lib/ai/prompts.ts`, `analyse-account.ts`, `counterfactuals.ts`, `portfolio-insights.ts`, `chat.ts` |
| API routes | `app/api/analyse/`, `analyse-all/`, `chat/`, `actions/`, `tasks/`, `comments/`, `activity/`, `accuracy/`, `audio/`, `voice-token/`, `portfolio-insights/` |
| Dashboard | `app/dashboard/page.tsx`, `components/dashboard/` |
| Account detail | `app/accounts/[id]/page.tsx`, `components/account/` |
| Auth | `app/login/page.tsx`, `app/auth/callback/route.ts`, `lib/supabase/`, `middleware.ts` |
| Voice (ElevenLabs) | `components/account/voice-chat.tsx`, `app/api/voice-token/route.ts` |
| DB migrations | `supabase/migrations/` |

## Database Tables

| Table | Purpose |
|-------|---------|
| `accounts` | 60 account records from CSV (read-only) |
| `ai_analyses` | Cached Claude analysis per account (JSONB fields: recommended_actions, key_signals, risk_factors, opportunity_factors) |
| `actions` | User-recorded actions + AI accuracy ratings |
| `portfolio_insights` | Portfolio-level AI insights |
| `profiles` | User profiles (auto-created on signup) |
| `user_tasks` | Adopted AI recommendations with status tracking |
| `comments` | Per-account threaded comments |

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
NEXT_PUBLIC_ENABLE_VOICE=true    # Feature flag: controls all voice UI
```

## Important Notes

- **Model ID**: Must be `claude-sonnet-4-20250514`. The ID `claude-sonnet-4-6-20250627` does NOT exist on this API key.
- **shadcn/ui variant**: Uses `@base-ui/react`, not Radix. Components use `render` prop instead of `asChild`. Select `onValueChange` passes `(value: string | null)`.
- **Supabase project**: `lgognnbyohczdgxnzjci` (EU West 1)
- **ElevenLabs**: TTS API requires paid plan; Conversational AI Agents work on free tier. Voice context is injected at runtime via `sendContextualUpdate()` in `voice-chat.tsx`.
- **Google OAuth**: Configured in Supabase + Google Cloud Console. If it breaks, toggle provider off/on in Supabase Dashboard.
- **Null handling**: 8 account fields can be null (NPS, CSAT, sentiment hint, QBR date, note date, overdue). Scoring uses sensible defaults, not zero.
- **Dashboard server component** (`app/dashboard/page.tsx`) fetches accounts, runs scoring engine server-side, then passes results as props to client components.

## Maintenance Rule

When making changes across conversations, update this file with:
- New features, API routes, or components added
- Gotchas or bugs discovered (especially API/integration issues)
- Env vars added or changed
- Architectural decisions made

## Related Docs

- `docs/technical-deep-dive-qa.md` — scoring model details, AI integration, null handling, validation results
- `../account_prioritisation_challenge_instructions.pdf` — original task requirements
- `../PLAN.md` — original implementation plan with scoring formulas
