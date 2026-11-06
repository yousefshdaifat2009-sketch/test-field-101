# LOCKED DECISIONS
Confirmed by the project owner. Do not change without explicit instruction.

## Core concept
- Game-like exploration with commands, choices, and progression.
- AI acts as BOTH narrator/GM and individual NPCs.
- Core loop: explore → find NPCs/quests → progress.
- Open-ended. No win condition, no ending.

## Server & channel
- Target: medium public server, 50–250 members.
- EXPECTED ACTIVE PLAYERS at any time: 10–20. The AI daily budget is
  sized for this reality, not for total member count.
- The game lives in ONE CHANNEL of an otherwise normal server.
- Clutter management:
  - ONE pinned hub message with buttons (edited, never reposted).
  - Ephemeral replies for ALL private info.
  - Public threads for scenes.
  - Threads auto-archive after 60 minutes of inactivity.
- Input: slash commands, buttons, select menus, modals ONLY.
- The bot NEVER reads or reacts to normal chat messages.
- Free-text ONLY inside modals.
- Text-only. No voice. No image generation.

## Admin / owner
- A single OWNER_DISCORD_ID env var identifies the game admin.
- The owner is the admin. Co-admins are added later via a
  comma-separated list in the same env var (no code change).
- All /admin commands check the caller's user ID against
  OWNER_DISCORD_ID and silently reject anyone else.

## One character per player
- One character per Discord user ID. No alts.
- Reset is admin-only via /admin reset @player. No self-service reset.

## Scenes are SHARED
- Any player may post in any active public scene thread. No join
  permission, no scene owner control.
- SCENE CAP: max 6 ACTIVE PARTICIPANTS per thread. The 7th active
  participant receives an ephemeral in-world refusal.
- "Present" / "active participant" = a player who has interacted in this
  thread at least once (clicked a button, submitted a modal, or joined).
  Silent readers are INVISIBLE to the bot — they do not count toward
  the 6-cap, receive no passive XP, and are not addressed by NPCs. This
  is a hard limit of the free stack (no gateway connection).
- AI context for a scene = the last 10 messages TOTAL in that thread
  (not per player), each labeled with the speaker's display name.
- NPC prompt must address players by name, never confuse speakers, and
  respond to the most recent speaker when several speak at once.
- XP attribution: the player who performed the action receives full XP.
  Other ACTIVE participants receive 25% passive XP.
- Quest progress is PER PLAYER even inside a shared scene.
- There is no scene owner role.

## Scene mechanics — OUTCOME-BASED
- XP is awarded WHEN THE SCENE ENDS, based on outcomes.
- Scene ends on either (a) the player taps Leave, or (b) a 15-minute
  cron sweep closes scenes with no message in 60 minutes. BOTH award XP.
- The sweep also archives the thread via REST and posts a closing line:
  "The night moves on." Zero AI cost.
- Outcome table:
  | Outcome | XP |
  |---------|----|
  | First visit to a location | 100 (once per location, ever) |
  | Met a new NPC (spoke in a scene you were in) | 50 (once per NPC, ever) |
  | Learned a clue | 100 |
  | Completed a MEANINGFUL action | 200 (once per scene, per player) |
  | Left the scene | 0 |
- MEANINGFUL ACTION: each action in locations.json and
  daytime_activities.json carries "meaningful": true/false. Only
  meaningful:true awards 200 XP, and only ONCE per player per scene.
- Bond: every NPC reply that directly addresses you = +1 bond with that
  NPC, capped at 3 per NPC per scene.
- Bond tiers: stranger 0 · acquaintance 10 · ally 30 · trusted 60 ·
  best friend 120. Best friend is the permanent ceiling.
- "Met an NPC" = that NPC spoke at least once in a scene you were
  present in. Counts once, ever.

## Daytime (06:00–18:00 JST) — four activities
All are DETERMINISTIC-FIRST: static menus, static text. AI is only
called if the player speaks to a core NPC.
- School (thread): NPCs Mahiru, Akira. Actions: attend class,
  hallway talk, skip class.
- Work (thread): NPC Midori (maid café) or konbini clerk. Actions:
  take a shift, talk to coworker/customer.
  Rewards XP ONLY — there is no currency system.
- Investigate (thread): NPC Anko. Actions: visit the agency, interview
  a witness, check the police station.
- Insomnia (EPHEMERAL, no thread): any time, solo. Actions: journal,
  check phone, stare at the ceiling. Can still fire quest hooks (a
  phone message that points somewhere) and award XP.

## The player experience
- New players: click "Begin" on the pinned hub → 5-step character
  creation FIRST → placed in their own apartment → hub buttons unlock.
- Character creation is STANDARD-DEEP, 5 ephemeral steps:
  1. name + appearance (one modal)
  2. personality traits (select menu, pick 3)
  3. background (student / worker / drifter)
  4. blood type (select: A, B, O, AB)
  5. stat spread (allocate 13 points across the 5 stats, min 1 each)
- Each player has their own apartment as home base / spawn point.
  Apartment type is randomly assigned at creation from a variant set.

## Stats (permanent, never changed by vampirism)
- Charm, Mystery, Nerve, Empathy, Night-sense.
- Vampirism adds new abilities and perks ON TOP. It never transforms
  the five core stats.

## Tracks
- At Level 1 the player chooses: A) Vampire track, B) Detective track.
- Switchable until Level 5, then permanently locked.
- Switching before Level 5: XP carries over; track-specific unlocks lost.
- Both tracks have IDENTICAL total XP requirements at every level.

## Time
- Real-time cycle anchored to Tokyo time (JST, UTC+9, no DST).
- NIGHT: 18:00 – 06:00 JST. DAY: 06:00 – 18:00 JST.
- Both transitions announced publicly by cron trigger.

## NPC roster — 11 core NPCs
- DEEP (full personality, memory, free-text): Nazuna, Kou, Akira, Anko,
  Kiku, Mahiru.
- LIGHT (short replies, single topic): Seri, Midori, Nico, Kabura, Hatsuka.
- BACKGROUND (narrator mentions only, no AI, no cost): Akihito (Seri's
  human companion, if present in this timeline — see 04), Kei (Kou's
  mother).
- MANGA-ONLY characters DO NOT EXIST in this timeline (e.g., Haruka,
  Azami, Susuki, Kiyosumi). Do not include or reference them.
- NPC avatars use a single placeholder URL at launch. The owner replaces
  each URL later by editing npcs.json.

## Bonds
- 5 tiers: stranger → acquaintance → ally → trusted → best friend.
- BEST FRIEND IS THE CEILING. Nothing exists above it.

## Quests
- TWO sources: Case Board (listed, pickable) AND discovery (found by
  exploring or through NPC conversation).
- Both feed the same quest log.
- COMPLETION: each quest carries a "completionRule" field with one of:
  "allClues" | "correctTheory" | "both". The engine reads the field.
  Most starter quests are "both".
- A quest may carry an optional "setsFlagOnComplete" field. On
  completion, the named world flag is set to true.
- There is NO combat system. "Hunting" in the detective track means
  investigation, tracking, and deduction — not fighting.

## Schedules
- LOOSE. Each NPC has a usual time and location but may appear elsewhere.

## Locations (11)
1. Player apartment (private, per-player, home base / spawn)
2. Rooftop
3. Convenience store (konbini)
4. School
5. Riverbank
6. Park
7. Love hotel district (tasteful, non-explicit — location only)
8. Anko's detective agency
9. Nazuna's apartment
10. Train station / underpass
11. Arcade

## Vampire rules
- Offspring at Level 5 is gated by SERVER ACTIVITY, not romance. Gate:
  5+ distinct play sessions; met 3+ vampire NPCs; attended 1+ night event.
- DEFINITIONS for the gate:
  - "Play session" = a distinct UTC day on which the player took at
    least one meaningful action (opened a scene, spoke to an NPC,
    clicked a quest clue, or used a daytime activity). Counted once
    per day.
  - "Met a vampire NPC" = that NPC spoke at least once in a scene the
    player was present in. Counted once per NPC, ever.
  - "Attended a night event" = clicked Join and entered the event
    thread at any point during the 2-hour window. Speaking is not
    required.
- LEVEL 5 IS A SOFT GATE on the vampire track: a player who reaches
  Level 5 without meeting the activity gate cannot advance to Level 6.
  XP keeps accumulating. Message: "The night notices you. But not yet."
- Sire selection at Level 5 is HYBRID: vampires the player has met
  appear as options, PLUS one system-assigned wildcard sire the player
  has NOT met.
- WILDCARD FIRST ENCOUNTER: choosing the wildcard auto-creates a thread
  in the game channel titled after that vampire. The opener is STATIC
  text loaded from npcs.json ("wildcardOpener" field). The sire speaks
  one static line, then the thread is live. ZERO AI cost for the opener.
- Wildcard pool and weights: Nazuna 3, Kiku 3, Seri 1, Midori 1, Nico 1,
  Kabura 1, Hatsuka 1. Kou and Anko are NOT eligible (Kou is half-vampire
  and cannot sire; Anko is human). Configurable in npcs.json.
- Blood hunger begins at NIGHT-TOUCHED (Level 40). Levels 5–39 experience
  no thirst.
- Offspring XP loop (5–39): sire tasks, night socializing, small proving
  jobs.
- Invitation rule is SOFT: vampires cannot enter a player's apartment
  scene unless invited. No deeper penalty.

## Detective 100→200 — two routes to half-vampirism
Both unlock at Level 100, both complete around Level 150. Neither is
faster — they are different flavors. DETAILS PARTIAL — see 04.
- Route A — "The Bite You Chose": a vampire offers the bite; the player
  accepts. Which vampire becomes a mentor/partner (never romantic). You
  chose to become partly what you hunt.
- Route B — flavor UNDECIDED. See 04_OPEN_QUESTIONS.

## Night events — AI-TRIGGERED, DETERMINISTICALLY GATED
- A cron runs every 3 hours and evaluates D1 state (free, no AI call).
- Fires only if ALL: no event in the last 48h, fewer than 2 events this
  week, AI budget has headroom. AND AT LEAST ONE OF: a player has been
  stuck at the Level 5 gate for 3+ days, 7+ days since the last event,
  or a world flag with can_trigger_event=true is set.
- WORLD FLAGS: stored in a world_flags table (flag_name, value, set_at,
  can_trigger_event). Flags are set by /admin setflag <name> or by a
  quest with "setsFlagOnComplete": "flag_name". The table starts EMPTY.
- On fire: ONE AI call generates the event (location, hook, choices).
- HARD SAFETY NET: if 7 days pass with no event, a CANNED TEMPLATE event
  fires at zero AI cost.
- Attending = clicking Join and entering the event thread. Speaking is
  not required.
- Event window: 2 hours. Max joiners: 10.

## XP sources (different per track)
- Detective: cases, clues, deductions, interrogations, patrols, informants.
- Vampire: sire tasks, blood/feeding (from L40), night socializing,
  night events, proving jobs.
- The two loops must FEEL different, not just be relabeled.

## Technology
- Cloudflare Workers + D1 + Groq. TypeScript.
- discord-interactions for signature verification; raw REST for responses.
- Deferred responses MANDATORY for every AI call.
- All state in D1. Nothing in memory between requests.
- AI provider swappable via one config value.
- Edited in github.dev from an iPad. Owner does not code.
- Owner budget: $0. Free tiers only. HARD REQUIREMENT.

## Hard narrative rule
- NPCs CANNOT love players. No romance routes. Ever.
- Max bond = best friend, high level only.
- The sire relationship is mentor / partner / colleague. Never romantic.
- Kou/Nazuna romance (if present) is BACKSTORY only. Never offered to
  players.
