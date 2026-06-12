# ⚽ World Cup Companion

A live 2026 FIFA World Cup match companion for your phone's browser — no app install needed.

**Dark tactical-board pitch view · Player scouting via LLM · Smart polling · Mobile-first**

> 🔑 **Bring-your-own-keys:** every user runs their own instance. No one else's usage ever bills your accounts.

---

## Features

- **Auto-opens the live match** using your device's timezone — no extra taps
- **Multi-match switcher** when several matches are live simultaneously
- **Upcoming fixture list** with local-time countdown when nothing is live
- **Floodlit vertical pitch** with players positioned by formation
- **Player tokens** colored by league tier (gold = Top-5 EU, blue = Other EU, green = Home League, clay = Minor)
- **Dashed ring** on players born outside the country they represent
- **Tap a player** → slide-up card with one vivid scouting phrase, club, and league
- **Scouting phrases** generated once by your chosen LLM and cached — never regenerated
- **Smart polling** — one check at kickoff, one at 46', then every 3 min from 60' to final whistle (+ ET)
- **Paste-fallback** if the team sheet hasn't dropped yet
- **Pluggable LLM** — Anthropic, OpenAI, Google Gemini, or OpenRouter (free models available)

---

## Quick Start (Vercel — recommended)

### Step 1 — Fork this repo

Click **Fork** on GitHub. This creates your own copy — your keys stay with you.

### Step 2 — Get your API keys

#### A. Football data (required)

1. Go to [dashboard.api-football.com/register](https://dashboard.api-football.com/register)
2. Create a free account — no credit card needed
3. Your key appears immediately on the dashboard under **API Key**
4. Free tier: **100 requests/day** — plenty for personal use with the smart polling schedule

#### B. LLM provider (pick one)

| Provider | Sign-up | Free tier? | Default model |
|---|---|---|---|
| **Anthropic** (recommended) | [console.anthropic.com](https://console.anthropic.com) | $5 free credit | `claude-haiku-4-5` |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | $5 free credit | `gpt-4o-mini` |
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com) | Free tier available | `gemini-1.5-flash-latest` |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) | ✅ Truly free models | `meta-llama/llama-3.1-8b-instruct:free` |

> **Cheapest option:** OpenRouter with the free Llama model — $0 LLM cost.

### Step 3 — Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/worldcup-companion)

Or via CLI:

```bash
npm i -g vercel
vercel
```

### Step 4 — Set environment variables in Vercel

In your Vercel project dashboard → **Settings → Environment Variables**, add:

```
FOOTBALL_API_KEY     = your-api-football-key
LLM_PROVIDER         = anthropic          # or openai / google / openrouter
ANTHROPIC_API_KEY    = your-anthropic-key # (only the one you're using)
```

That's it. Redeploy, bookmark the URL, open it on your iPhone during a match.

---

## Local Development

```bash
git clone https://github.com/YOUR_USERNAME/worldcup-companion
cd worldcup-companion
npm install

# Copy and fill in your keys
cp .env.example .env.local
# Edit .env.local with your actual keys

npm run dev
# Open http://localhost:3000
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `FOOTBALL_API_KEY` | ✅ | API-Football key from dashboard.api-football.com |
| `LLM_PROVIDER` | ✅ | `anthropic` / `openai` / `google` / `openrouter` |
| `ANTHROPIC_API_KEY` | If using Anthropic | From console.anthropic.com |
| `OPENAI_API_KEY` | If using OpenAI | From platform.openai.com |
| `GEMINI_API_KEY` | If using Google | From aistudio.google.com |
| `OPENROUTER_API_KEY` | If using OpenRouter | From openrouter.ai |
| `LLM_MODEL` | Optional | Override the default model for your provider |

---

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Main page — fixture orchestration + polling
│   ├── layout.tsx            # App shell, viewport meta
│   ├── globals.css           # All styles (dark tactical-board theme)
│   └── api/
│       ├── fixtures/route.ts # Live + today + upcoming fixtures
│       ├── lineup/route.ts   # Confirmed starting XIs + formations
│       ├── events/route.ts   # Match events (goals, cards, subs)
│       └── scout/route.ts    # LLM scouting notes (cached)
├── components/
│   ├── PitchView.tsx         # Floodlit pitch with player tokens
│   ├── PlayerToken.tsx       # Individual player dot
│   ├── PlayerCard.tsx        # Slide-up player detail card
│   ├── MatchInfo.tsx         # Coach, formation, subs, goals, why-watch
│   ├── Countdown.tsx         # Live countdown to kickoff
│   └── Legend.tsx            # Tier colour legend
├── lib/
│   ├── football-api.ts       # API-Football wrapper (server-only)
│   ├── llm-provider.ts       # Pluggable LLM via Vercel AI SDK
│   └── scout-cache.ts        # /tmp JSON cache for scouting phrases
└── types/index.ts            # Shared TypeScript types
```

**Key design decisions:**

- All API keys live in server-side API routes only — they never reach the client bundle
- Scout notes are cached in `/tmp` (within a Vercel function instance); persistent storage (Upstash Redis, Vercel KV) is the easy upgrade path
- The LLM provider abstraction uses the Vercel AI SDK — swap providers by changing one env var
- Polling is intentionally conservative: the API-Football free tier (100 req/day) survives a full tournament day of personal use

---

## Upgrading the scout cache

The default cache is an in-memory JSON file in `/tmp`. For a proper persistent cache:

1. Create a free [Upstash Redis](https://upstash.com) database
2. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to env vars
3. Swap `src/lib/scout-cache.ts` for the `@upstash/redis` implementation (two functions)

---

## License

MIT — see [LICENSE](./LICENSE)
