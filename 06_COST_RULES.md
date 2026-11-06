# COST RULES — HARD $0 BUDGET

The owner will not pay anything. Every AI call must fit inside free tiers.
These are requirements, not preferences.

## The three levers
1. Fewer calls (cooldowns, fallbacks, no ambient chatter)
2. Shorter calls (short replies, short memory, small prompts)
3. Cheaper model (smallest Groq model with acceptable quality)

## Mandatory implementation

### Daily budget guard
- Config `DAILY_AI_BUDGET` (default 900, headroom under Groq's ~1,000).
- A D1 counter increments on every AI call.
- When the counter reaches the budget, AI calls stop for the day.
- Fallback: NPC replies with a short in-world line such as
  "…the night goes quiet." Never an error, never a stack trace.
- The counter resets at the 06:00 Tokyo cron (21:00 UTC).

### Per-player cooldown
- `NPC_CHAT_COOLDOWN_SECONDS` (default 20) between AI replies per player.
- `NPC_CHAT_DAILY_CAP` (default 60 AI messages/day per player).
- Cooldown replies are in-world: "(They're quiet for a moment.)"

### Deep vs Light NPCs
| Mode | NPCs | Prompt | Reply | Memory |
|------|------|--------|-------|--------|
| Deep | Nazuna, Kou, Akira, Anko, Kiku, Mahiru | full personality | 2–4 sentences | last 10 msgs |
| Light | Seri, Midori, Nico, Kabura, Hatsuka | short personality | 1–2 sentences | last 4 msgs |

### Memory
- Store only the last N messages per (player, NPC) pair in D1.
- N is 10 for Deep, 4 for Light.
- Never send full history. Never send global history.
- Scene context is capped at 10 messages TOTAL per thread, not per
  player. In crowded scenes, older messages drop out of context even if
  they belong to a still-present player.

### Prompt design
- System prompt: NPC personality + world rules summary. Under ~400 tokens.
- Inject only: world rules summary, this NPC's personality, this player's
  relevant state (name, level, track, bond tier), and the last N messages.
- Cache static prompt prefixes where the provider supports it.

### Deterministic-first
If a response can be produced by code, it MUST be produced by code.
AI is used ONLY for: NPC dialogue, and scene narration where the outcome
is not already determined.

Everything else — menus, stats, levels, bond counters, location lists,
character creation validation, level-up text, bond math, case board
listings, daytime activity text, event trigger checks, error messages —
is static or computed. **No AI call.**

### What we do NOT do (each would burn the budget)
- No ambient/background AI chatter.
- No AI-generated images.
- No AI narration of every click.
- No AI to decide WHEN an event fires (deterministic cron math does that).
  AI is called once, only to write the event's text.
- No AI for the Case Board listing.

## Monitoring
`/admin stats` reports: AI calls today, budget remaining, per-NPC call
counts, most active players. The owner uses this to tune caps.
