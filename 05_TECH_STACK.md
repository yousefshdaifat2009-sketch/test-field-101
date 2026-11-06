# TECH STACK & HARD CONSTRAINTS — LOCKED

## The constraint that drives everything
The owner works on an iPad 9, has a $0 budget, and does not write code.
Everything must be editable from a browser and hosted free, forever,
with no credit card.

## Stack
| Layer | Choice |
|-------|--------|
| Runtime | Cloudflare Workers |
| Language | TypeScript |
| Discord | `discord-interactions` (verify) + raw REST (respond) |
| Database | Cloudflare D1 (SQLite) |
| AI | Groq free tier, via OpenAI-compatible endpoint |
| Scheduling | Cloudflare Cron Triggers (runs in UTC) |
| Editor | github.dev in Safari |
| Version control | GitHub (private repo), auto-deploy to Cloudflare |

## ⚠️ Do NOT use discord.js
discord.js requires a persistent gateway (websocket). Cloudflare Workers
cannot hold one. Use `discord-interactions` for Ed25519 verification and
call the Discord REST API directly for every response.

## What this stack CANNOT do
- No persistent gateway / websocket.
- Cannot read or react to normal chat messages.
- Cannot detect silent readers in a thread (only interacted players count).
- Cannot join voice channels.
- Cannot send unsolicited messages except via cron trigger.
- Cannot run longer than a single request.

## Mandatory patterns

### 1. Signature verification
Every request from Discord must be verified with Ed25519 using
DISCORD_PUBLIC_KEY. Reject anything unverified with 401.

### 2. Deferred responses (MANDATORY for AI calls)
Discord requires a response within 3 seconds.
- Respond immediately with type 5 (deferred) or the ephemeral equivalent.
- Then edit the original response via
  `PATCH /webhooks/{app_id}/{interaction_token}/messages/@original`.
- Never call the AI before deferring.

### 3. Statelessness
Nothing lives in memory between requests. All player state, world state,
scene state, and cooldowns live in D1.

### 4. Command registration
Expose a `GET /register` route that registers all slash commands with
Discord. The owner visits it once in Safari.

### 5. Cron (Cloudflare runs cron in UTC; Tokyo is UTC+9)
| Cron | UTC | Purpose |
|------|-----|---------|
| `0 9 * * *` | 09:00 | 18:00 Tokyo — "🌙 The night begins." |
| `0 21 * * *` | 21:00 | 06:00 Tokyo — "☀️ The sun rises." + AI budget reset |
| `0 */3 * * *` | every 3h | Night event trigger evaluation |
| `*/15 * * * *` | every 15m | Scene sweep: close stale scenes (60 min idle), award outcome XP, archive threads via REST, close expired event threads |

The cron handlers read GAME_CHANNEL_ID from env and post via REST.

### 6. Provider-agnostic AI
A single module `ai.ts` exposes `chat(messages, options)`. Provider chosen
by `AI_PROVIDER` env var. Groq is the default. Swapping providers must
require no changes outside that module.

### 7. Secrets
Never in the repo. Set in Cloudflare Worker → Settings → Variables:
DISCORD_PUBLIC_KEY, DISCORD_APP_ID, DISCORD_BOT_TOKEN, GROQ_API_KEY,
GAME_CHANNEL_ID, OWNER_DISCORD_ID.

### 8. Bindings
D1 binding named `DB`.

### 9. Time calculation
All game time uses Tokyo (UTC+9). Store timestamps in UTC in D1.
Convert for display and day/night logic:
`tokyoHour = (utcHour + 9) % 24`.

### 10. Presence detection (important limitation)
The bot cannot see who is reading a thread. "Present" / "active
participant" means a player who has interacted in this thread at least
once (clicked a button, submitted a modal, or pressed Join). Silent
readers are invisible. All presence logic must be built on this
definition. Do not attempt to detect readership.

### 11. Admin verification
Every `/admin` command checks the caller's user ID against
OWNER_DISCORD_ID (comma-separated list is supported). Silent reject
otherwise — no error message that reveals admin commands exist.

## Free-tier limits to respect
| Service | Limit |
|---------|-------|
| Workers | ~100,000 requests/day |
| D1 | 5 GB, 5M reads/day |
| Groq | ~1,000 requests/day, rate limited |
| Groq per-minute | rate-limited on tokens/min (graceful fallback handles it) |

## Admin requirements
The owner must change NPC text, locations, quests, and balance numbers
WITHOUT editing code. Everything content-related lives in JSON in
`/data/`. Admin slash commands: `/admin reset @player`,
`/admin grantxp @player N`, `/admin spawn-event`, `/admin setflag <name>`,
`/admin reload-config`, `/admin stats`.

## Deploy flow
GitHub commit → Cloudflare auto-deploy → live.
The owner never touches the Cloudflare dashboard except to set secrets
and add the D1 binding once.
