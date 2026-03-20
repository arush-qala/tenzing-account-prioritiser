# CLAUDE.md — Tenzing Account Prioritiser

## What This Is

AI-powered account prioritisation tool for PE portfolio leadership. Built for the Tenzing AI Sherpa Programme technical challenge (due 23 March 2026).

**Live**: https://tenzing-account-prioritiser.vercel.app
**Repo**: https://github.com/arush-qala/tenzing-account-prioritiser

## Related Docs (read the codebase for software details, these for context)

- **Interview context**: `../../CONTEXT.md` — application status, company facts, fit assessment, Q&A prep, Lucia's feedback
- **Challenge brief**: `../account_prioritisation_challenge_instructions.pdf` — the original task requirements
- **Parent CLAUDE.md**: `../../CLAUDE.md` — Tenzing folder-level context, role details, key facts
- **Build plan**: `../PLAN.md` — original implementation plan with scoring formulas
- **Technical deep-dive Q&A**: `docs/technical-deep-dive-qa.md` — detailed Q&A covering: scoring model (all weights, signals, thresholds), AI integration (model, data inputs, independence of layers), null handling strategy, ML limitations (why unsupervised only, why ML can't set weights), evaluation without outcome labels, Lucia's success metrics mapping, validation results. Use for write-up appendix content.
- **Lucia's success metrics email**: `../email response about my question.txt` — confirms success metrics: pipeline conversion, expansion, churn reduction. Users are CRO/VP Sales/Head of CS working cross-functionally.

## Maintenance Rule

When making changes to this project across conversations, update this file with:
- Any new features, API routes, or components added
- Any gotchas or bugs discovered (especially API/integration issues)
- Any env vars added or changed
- Any architectural decisions made

## Tech Stack

- Next.js 14 (App Router, TypeScript) + Tailwind + shadcn/ui (base-ui variant)
- Supabase (PostgreSQL + Auth with Google OAuth)
- Claude API (Anthropic SDK, model: `claude-sonnet-4-20250514`)
- ElevenLabs Conversational AI Agent (voice chat)
- Vercel for deployment

## Architecture

**Two-phase prioritisation:**
1. **Deterministic scoring** (`lib/scoring/engine.ts`) — 5 weighted sub-scores (Revenue, Engagement, Support, Opportunity, Urgency) → calibrated priority score → tier assignment. Transparent, auditable.
2. **AI contextual analysis** (`lib/ai/`) — Claude synthesises scores + free-text notes into reasoning, recommended actions, risk/opportunity factors, counterfactuals.

## Key Files

| Area | Files |
|------|-------|
| Scoring engine | `lib/scoring/engine.ts`, `weights.ts`, `signals.ts`, `contradictions.ts`, `calibration.ts` |
| AI prompts & analysis | `lib/ai/prompts.ts`, `analyse-account.ts`, `counterfactuals.ts`, `portfolio-insights.ts`, `chat.ts` |
| API routes | `app/api/analyse/`, `analyse-all/`, `chat/`, `actions/`, `tasks/`, `comments/`, `activity/`, `accuracy/`, `audio/`, `voice-token/`, `portfolio-insights/` |
| Dashboard | `app/dashboard/page.tsx`, `components/dashboard/` |
| Account detail | `app/accounts/[id]/page.tsx`, `components/account/` |
| Nav features | `components/notification-bell.tsx`, `components/ai-accuracy-indicator.tsx` |
| My Actions | `app/actions/page.tsx` |
| Auth | `app/login/page.tsx`, `app/auth/callback/route.ts`, `lib/supabase/`, `middleware.ts` |
| Voice (ElevenLabs) | `components/account/voice-chat.tsx`, `app/api/voice-token/route.ts` |
| DB migrations | `supabase/migrations/001_create_tables.sql`, `002_profiles_tasks_comments.sql` |

## Database Tables

| Table | Purpose |
|-------|---------|
| `accounts` | 60 account records from CSV (read-only) |
| `ai_analyses` | Cached Claude analysis per account |
| `actions` | User-recorded actions + AI accuracy ratings |
| `portfolio_insights` | Portfolio-level AI insights |
| `profiles` | User profiles (auto-created on signup) |
| `user_tasks` | Adopted AI recommendations with status tracking |
| `comments` | Per-account threaded comments |

## Features Built

- Google OAuth + email sign-up/sign-in
- Dashboard with portfolio summary (clickable cards with Sheet drill-down), renewal timeline (tier swim lanes scatter chart with time-range toggle), AI portfolio insights (collapsible 2-col sections with coloured borders)
- Priority list table with per-row Analyse button, sorting, enhanced filtering (lifecycle stage, renewal range, ARR range, quick-filter presets)
- Account detail page restructured as accordion sections with "At a Glance" metric strip: Score Decomposition + AI Analysis expanded by default, Notes/What-If/Comments collapsed
- Notification bell in nav (activity feed relocated from dashboard)
- AI accuracy badge in nav (compact indicator with popover donut chart)
- One-click action adoption from AI recommendations → My Actions page (to-do list)
- Per-account comments with user attribution
- Text-based AI chat (Claude, streaming, side pane)
- ElevenLabs voice chat (Conversational AI Agent, real-time)
- Feature flag: `NEXT_PUBLIC_ENABLE_VOICE=true/false` controls all voice features
- Page-level guidance text (titles, subtitles, interaction hints) on all pages

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=agent_5001kh49bb4aed1srench7ecjpde
NEXT_PUBLIC_ENABLE_VOICE=true
```

## Important Notes

- **Model ID**: Must be `claude-sonnet-4-20250514`. The ID `claude-sonnet-4-6-20250627` does NOT exist on this API key.
- **shadcn/ui variant**: Uses `@base-ui/react`, not Radix. Components use `render` prop instead of `asChild`. Select `onValueChange` passes `(value: string | null)`.
- **Supabase project**: `lgognnbyohczdgxnzjci` (EU West 1)
- **ElevenLabs free tier**: TTS API requires paid plan. Conversational AI Agents work on free tier.
- **Google OAuth**: Configured in Supabase + Google Cloud Console. If it breaks, toggle provider off/on in Supabase Dashboard.

## Swapping API Keys

If switching to new accounts for any of these services, here's exactly what to change. No code changes needed — env vars only.

| Service | Env Var(s) to Update | Update in `.env.local` | Update in Vercel Dashboard | Extra Steps |
|---------|---------------------|----------------------|--------------------------|-------------|
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | Yes | Yes | None |
| ElevenLabs | `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` | Yes | Yes | Create a new Conversational AI Agent in the new ElevenLabs account dashboard, then copy the new agent ID. Same account + new key = no new agent needed. |
| Thesys | `THESYS_API_KEY` | Yes | Yes | None |

**Supabase stays unchanged** — same project, same credentials, same data.

**Note:** If only regenerating a key on the SAME account (not switching accounts), just swap the key in both places. ElevenLabs agent ID only changes when switching to a different account.

### Recreating the ElevenLabs Conversational AI Agent

If switching ElevenLabs accounts, create a new agent in the dashboard (takes ~2 minutes):

1. Go to [ElevenLabs dashboard](https://elevenlabs.io) → Conversational AI → Create Agent
2. **Agent name:** Portfolio Analyst
3. **Voice:** Pick any voice (the original used a default English voice)
4. **First message:** Leave blank (the app sends context dynamically)
5. **System prompt:** Use a minimal prompt like: `You are a portfolio analyst at a B2B tech PE firm. You help commercial leadership understand account health, churn risk, and expansion opportunities. Be concise and reference specific data points. Use British English and GBP formatting.`
6. Save → copy the new **Agent ID** from the agent settings page
7. Update `ELEVENLABS_AGENT_ID` in `.env.local` and Vercel

**Why so simple:** The actual per-account context (metrics, scores, notes) is injected at runtime via `sendContextualUpdate()` in `components/account/voice-chat.tsx` (line 127). The agent itself just needs a basic persona.

## Future Roadmap (for write-up)

1. Generative UI Chat — AI generates dynamic charts/tables/summaries in response pane
2. Portfolio-level AI chat
3. CRM integration (Salesforce/HubSpot)
4. Slack/Teams alerts for tier changes
5. Weekly digest emails
6. Custom scoring weights (user-adjustable sliders)
7. Portfolio health trends over time
8. Persistent chat history
9. Saved filters & watchlists
10. Export to PDF
