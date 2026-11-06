# BUILD ORDER — for the coding AI

Build strictly in this order. Each chunk must be deployed and verified
before the next begins. Do not combine chunks. Do not skip ahead.
After each chunk, tell the owner exactly how to test it.

All game times are Tokyo (JST, UTC+9). Cron runs in UTC.

---

## CHUNK 1 — Skeleton & verification
- Worker entry point with Ed25519 signature verification
- `GET /` returns 200 (Discord endpoint verification)
- PING interaction (type 1) → PONG
- `GET /register` registers `/ping` and `/help`
- `/ping` replies ephemerally: "Pong — <latency>ms"
- Config module reading env vars
- Basic project structure and README

Acceptance: owner pastes the Worker URL into the Discord Developer Portal
and it saves. `/ping` works in the channel.

---

## CHUNK 2 — D1 schema, config loader, content drafting
- D1 migration tables: players, npc_bonds, scenes, scene_participants,
  scene_messages, quests_progress, cooldowns, world_state, world_flags,
  ai_usage, events, event_attendance
- JSON loader for `/data/*.json` with clear validation errors naming the
  bad field
- `/admin reload-config` (owner-only, verifies OWNER_DISCORD_ID)
- `/admin seed`
- **DRAFT ALL JSON CONTENT**: 11 NPC personality profiles (each with
  `wildcardOpener` for sire-eligible vampires), 11 location scene openers,
  12+ starter quests across both tracks (with `completionRule` and
  optional `setsFlagOnComplete`), daytime activity text for all four
  activities, 5+ event templates. Mark every draft with
  `"status": "draft"`.

Acceptance: tables exist, `/admin reload-config` succeeds, `/admin stats`
returns zeros, all JSON files validate.

---

## CHUNK 3 — Pinned hub & character creation
- Post the pinned hub message (with `Begin` button)
- 5-step ephemeral character creation:
  1. name + appearance (modal)
  2. personality traits (select menu, pick 3)
  3. background (student / worker / drifter)
  4. blood type (select: A, B, O, AB)
  5. stat spread (allocate 13 points across 5 stats, min 1 each)
- Save player to D1, assign a random apartment variant
- ONE character per Discord user ID enforced
- `/sheet` shows the character card (ephemeral)
- After creation, hub buttons become active for that player

Acceptance: owner completes creation, sees their sheet, cannot create
twice with the same Discord user ID.

---

## CHUNK 4 — Locations, shared exploration, scene sweep
- `/explore` → ephemeral location list (locations.json), filtered by
  day/night (Tokyo time) and by track
- Selecting a location creates a public thread in the game channel
- Narrator posts scene opener (AI call, deferred)
- Buttons for 2–3 contextual actions inside the thread
- **SHARED SCENES**:
  - "Active participant" = interacted at least once. Silent readers are
    invisible — do not attempt to detect them.
  - Enforce maxPlayersPerThread (6 ACTIVE participants). The 7th active
    participant receives an ephemeral in-world refusal.
  - Scene state table: scene_id, players_present[], recent_messages[]
    (last 10, each with speaker_id and display_name)
  - Any active participant may click actions or post free-text
  - XP attribution: actor gets full XP; other active participants get
    25% passive XP
  - Quest clue attribution is PER PLAYER
- Apartment: private-ish scene, invitation state tracked
- Leaving archives the thread
- **SCENE SWEEP CRON (`*/15 * * * *`)**: find scenes with no message in
  60 minutes, compute and award outcome XP to all active participants,
  post a closing line ("The night moves on."), archive via REST, mark
  closed in D1. Zero AI calls. Also closes expired event threads.

Acceptance: owner explores 3 locations; a second test account walks in;
the 7th active participant is refused; a scene with no message for
60 minutes is swept, XP awarded, thread archived.

---

## CHUNK 5 — NPC dialogue
- `ai.ts` with `chat()` supporting Groq via OpenAI-compatible endpoint
- Deep and Light prompt templates
- Memory write/read (10 Deep, 4 Light)
- **Scene context: last 10 messages TOTAL per thread**, each labeled with
  speaker display name
- NPC replies posted via webhook (NPC name + avatar) inside the thread
- Free-text input via modal ("Say something")
- Per-player cooldown + daily cap + global daily budget guard
- Graceful in-world fallback when budget exhausted
- NPC prompt instructions: address players by name; never confuse
  speakers; respond to the most recent speaker when multiple speak at once
- Placeholder avatar URL used for all NPCs until owner replaces them

Acceptance: owner talks to Nazuna (Deep) and Seri (Light) in character.
Two players in one scene are both addressed correctly by name. Cooldown
triggers. Simulated budget exhaustion produces the in-world fallback.

---

## CHUNK 6 — XP, levels, tracks, meaningful actions
- XP award function with all anti-grind rules
- XP curve loaded from xp_curve.json
- **OUTCOME-BASED SCENE XP**: computed at scene end (Leave OR cron sweep,
  both award). Outcome table from 01_LOCKED.
- **MEANINGFUL ACTION**: only actions with `"meaningful": true` award
  200 XP; awards ONCE per player per scene regardless of clicks
- **Bond**: +1 per NPC reply that directly addresses the player, capped
  3 per NPC per scene. Tier thresholds from 08.
- `/progress` ephemeral card with bar and next-tier info
- Track selection at Level 1, switchable until Level 5, locked after
- Level-up notifications (ephemeral), tier notifications (public)
- Daily caps; return bonus capped to once per week
- Level 5 soft gate on the vampire track (blocks Level 6 until gate met)

Acceptance: owner reaches Level 6 on a test account, gets the switch lock,
sees tier text at the right levels. Vampire-track test shows the Level 5
gate blocking advancement. Bond increases in a scene and caps at 3.
Clicking a meaningful action 3× awards 200 XP only once.

---

## CHUNK 7 — Day/night, cron, events, daytime activities
- Cron handlers:
  - `0 9 * * *` UTC → 18:00 Tokyo → night begins announcement
  - `0 21 * * *` UTC → 06:00 Tokyo → sunrise announcement + AI budget reset
  - `0 */3 * * *` UTC → event trigger evaluation
- **EVENT TRIGGER (deterministic, no AI)**: fires only if no event in 48h
  AND <2 events this week AND budget headroom AND (a player stuck at the
  Level 5 gate 3+ days OR 7+ days since last event OR a world_flag with
  can_trigger_event=true is set)
- On fire: ONE AI call generates the event text. Written to D1.
- **HARD SAFETY NET**: if 7 days pass with no event, a canned template
  from events.json fires at zero AI cost
- Public event message with Join button. Attendance recorded on join.
  Window 2 hours, max 10 joiners.
- Hub message edited to reflect day vs night
- `/explore` filters change by phase
- **DAYTIME ACTIVITIES** (four, from daytime_activities.json):
  - School, Work, Investigate → open THREADS (they have NPCs)
  - Insomnia → EPHEMERAL one-shot reply (solo, no thread)
  - All are static unless a core NPC is present in that activity
- `world_state` row updated
- World flags mechanism: world_flags table, `/admin setflag <name>`,
  quest `setsFlagOnComplete` integration

Acceptance: temporarily set a cron to fire in 2 minutes; verify both
announcements and hub updates. Force the 7-day safety net and confirm a
template event fires with no AI call. Use a daytime activity and confirm
zero AI calls unless an NPC is present. Use `/admin setflag` and confirm
the flag triggers an event on the next cron cycle.

---

## CHUNK 8 — Quests & case board
- `/cases` ephemeral board listing available quests from quests.json
- Quest discovery via exploration (location flags a quest)
- Quest progress tracking in D1, per player
- **Completion rule read from `completionRule` field** per quest:
  "allClues" | "correctTheory" | "both"
- **setsFlagOnComplete**: on quest completion, if the field is present,
  set the named world flag to true
- Notebook (`/notebook`): list clues; combine two clues into a theory;
  correct theories award bonus XP
- Quest completion awards XP and updates the board

Acceptance: owner starts a quest with each completionRule type and
completes each. In a shared scene, two players both record the same clue
in their own notebooks. A quest with setsFlagOnComplete flips the flag.

---

## CHUNK 9 — Bonds & sire selection
- Bond XP per NPC with locked tier thresholds
- Bond tier shown in `/sheet` and in NPC conversation context
- Level 5 activity gate check (5 sessions, 3 vampires met, 1 event,
  using the definitions from 01_LOCKED)
- Sire selection: met vampires + one random wildcard from the weighted
  pool
- **WILDCARD AUTO-THREAD**: choosing the wildcard creates a thread titled
  after the vampire. Opener is STATIC text from `npcs.json`
  (`wildcardOpener`). The sire speaks one static line. ZERO AI cost for
  the opener. Thread becomes live for normal AI dialogue afterward.
- Offspring status stored and reflected in narration
- Hunger flag activates at Level 40

Acceptance: owner reaches Level 5 on a test account, sees the gate, picks
a sire (including the wildcard path — verify the auto-thread opens with
static text and 0 AI calls), sees offspring status.

---

## CHUNK 10 — Admin, cost controls, polish
- All `/admin` commands (verify OWNER_DISCORD_ID on every one)
- `/admin stats` AI usage report
- `/admin setflag <name>` implementation
- Rate-limit edge cases: double clicks, stale threads, deleted threads,
  players leaving mid-scene
- Error handling for every Discord interaction type
- Graceful messages for every failure mode
- Final pass: no hardcoded content, all strings from JSON where they
  should be

Acceptance: full playthrough of the core loop with no errors in
Cloudflare logs. A non-owner trying `/admin` commands is silently refused.

---

## After Chunk 10
Remaining work is CONTENT, not code: more quests, more NPC variants,
more locations, more event templates. All JSON edits.
