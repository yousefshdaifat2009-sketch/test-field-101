# OPEN QUESTIONS — UNDECIDED
Do NOT invent answers. Do NOT hardcode assumptions. Ask the owner.

## Still undecided (owner to answer)
- Q54: Detective 100→200 "Route B" flavor. Options on the table:
  (A) "The Blood You Found" — a vial / dying vampire / black market;
  you drink it alone; no mentor; morally ambiguous.
  (B) A lab / scientist / experiment on yourself.
  (C) A dying vampire gives blood as a gift — tender, sad, not alone.
  Owner will decide before content-writing phase.
- Q55: Server owner buy-in for deploying the bot into the community
  server. Owner will confirm before Phase D.
- Sunlight effects on vampires (lethal / weakening / harmless).
- Whether the vampire world is secret, rumored, or publicly known.
- What is Nazuna's stated reason for returning to the city?
- Kiku Hoshimi's alignment in this timeline (antagonist / reformed /
  neutral / ambiguous)?
- Do Akihito and Kei exist in this timeline? Akihito may be manga-only.
- The wildcard sire: does choosing one come with a mini-questline?
- Exact daytime action tables per activity (attend class XP, shift XP,
  etc.).
- Exact bond XP values per NPC beyond the +1 per reply.

## Tunable defaults (owner may override; Z.ai builds with these)
- Active player count expected: 10–20 at a time. If real numbers exceed
  30 concurrent, revisit DAILY_AI_BUDGET and npcChatDailyCap.
- Bond thresholds: acquaintance 10, ally 30, trusted 60, best friend 120.
- Bond per exchange: +1, capped at 3 per NPC per scene.
- Return bonus (2× after 3+ days away) is capped to once per week.
- Scene XP: first visit 100, new NPC 50, clue 100, meaningful action 200.
- Passive XP for non-acting active participants: 25%.
- Activity gate: 5 sessions, 3 vampires met, 1 event.

## Content authorship
- Z.ai drafts ALL JSON content in Chunk 2 (NPC personalities, location
  scene openers, wildcard opener lines, 12+ starter quests, daytime
  activity text, event templates). Owner then edits what feels wrong.
- The owner is the EDITOR, not the author. Plan accordingly.

## Setup to-dos (not code — must exist before launch)
- Discord: create application at discord.com/developers/applications,
  copy Bot Token / App ID / Public Key, generate OAuth2 invite URL.
- Discord: enable Developer Mode, copy owner's own user ID for
  OWNER_DISCORD_ID.
- Discord: server owner must invite the bot (requires Manage Server).
- Discord: create #night-city channel, grant the bot permissions
  (Send Messages, Embed Links, Create Public Threads, Send Messages in
  Threads, Manage Threads, Manage Messages).
- Cloudflare: create D1 database "nightcity", add binding "DB".
- Groq: create API key.
- 11 NPC avatar image URLs — placeholder ships at launch. Recommended
  hosting: assets/npcs/ folder in the GitHub repo, raw.githubusercontent
  URLs (permanent, free).

## Systems not yet specified
- Frequency/format of scheduled night events on top of AI triggers.
- Whether character appearance affects anything beyond flavor text.

## Deferred features (do not build without instruction)
- PvP / hunter-vs-vampire mode
- Currency, shopping, inventory, items
- Player-owned locations beyond the apartment
- Trading between players
- Factions / clans
- Leaderboards
- Achievements / badges
- Web dashboard
- Image generation
- Voice / TTS
- Multi-language
