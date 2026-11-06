# JSON SCHEMAS — content files in /data/

All game content lives here. The owner edits these files; code never
hardcodes content. Every file must validate on load with a clear error
naming the bad field.

Every content object should carry `"status": "draft"` or `"final"` so the
owner can find Z.ai's drafts and rewrite them.

---

## `data/config.json`
```json
{
  "gameChannelId": "ENV: GAME_CHANNEL_ID",
  "ownerDiscordId": "ENV: OWNER_DISCORD_ID",
  "nightStartHour": 18,
  "nightEndHour": 6,
  "timezoneOffsetHours": 9,
  "cooldowns": { "npcChatSeconds": 20, "npcChatDailyCap": 60 },
  "scenes": {
    "maxPlayersPerThread": 6,
    "aiContextMessages": 10,
    "passiveXpMultiplier": 0.25,
    "sweepEveryMinutes": 15,
    "staleAfterMinutes": 60
  },
  "bonds": {
    "perExchange": 1,
    "perNpcPerSceneCap": 3,
    "tiers": { "acquaintance": 10, "ally": 30, "trusted": 60, "bestFriend": 120 }
  },
  "sceneXp": {
    "firstVisitLocation": 100,
    "newNpc": 50,
    "clue": 100,
    "meaningfulAction": 200
  },
  "activityGate": {
    "sessionsRequired": 5,
    "vampiresMetRequired": 3,
    "eventsAttendedRequired": 1
  },
  "ai": {
    "provider": "groq",
    "dailyBudget": 900,
    "deepModel": "model-id",
    "lightModel": "model-id",
    "maxTokensDeep": 220,
    "maxTokensLight": 120,
    "memoryDeep": 10,
    "memoryLight": 4
  },
  "features": { "combat": false, "inventory": false, "currency": false }
}
```

`timezoneOffsetHours` is Tokyo (UTC+9).

---

## `data/npcs.json`
```json
[
  {
    "id": "nazuna",
    "name": "Nazuna Nanakusa",
    "mode": "deep",
    "isVampire": true,
    "canBeSire": true,
    "sireWeight": 3,
    "avatarUrl": "https://placeholder-url-for-all-npcs",
    "wildcardOpener": "She's already sitting on the ledge when you reach the rooftop. 'Took you long enough,' she says, without turning around.",
    "personality": "Voice, mannerisms, what she cares about, how she treats strangers vs friends.",
    "usualLocation": "rooftop",
    "usualPhase": "night",
    "greeting": "Oh? You're up here too?",
    "dayAvailability": "rare",
    "forbidden": ["romance", "declaring love", "leaving the city"],
    "status": "draft"
  }
]
```

Rules:
- `mode`: `deep` or `light`.
- `isVampire`: gates sire eligibility and invitation behavior.
- `canBeSire` + `sireWeight`: wildcard pool. Weight 0 = excluded.
- `wildcardOpener`: STATIC text shown when this NPC is chosen as a
  wildcard sire. Required for every sire-eligible NPC. Zero AI cost.
- `dayAvailability`: `always` | `rare` | `never`.
- `forbidden`: extra per-NPC rules appended to the world rules.
- 11 entries at launch. Deep: nazuna, kou, akira, anko, kiku, mahiru.
  Light: seri, midori, nico, kabura, hatsuka.
- Sire weights: nazuna 3, kiku 3, seri/midori/nico/kabura/hatsuka 1.
  kou, anko, akira, mahiru = 0 (ineligible — no wildcardOpener needed).
- `avatarUrl` is the SAME placeholder for all 11 at launch. Owner
  replaces individually later (recommended: assets/npcs/ folder in the
  repo, raw.githubusercontent.com URLs).

---

## `data/locations.json`
```json
[
  {
    "id": "rooftop",
    "name": "Rooftop",
    "phase": "night",
    "trackVisibility": "all",
    "npcs": ["nazuna", "kou"],
    "sceneOpener": "The wind carries the smell of rain that never came. Below, the city hums.",
    "actions": [
      { "id": "approach", "label": "Approach", "narration": true, "meaningful": true },
      { "id": "watch", "label": "Watch quietly", "narration": true, "meaningful": false },
      { "id": "leave", "label": "Leave", "narration": false, "meaningful": false }
    ],
    "questHooks": ["q_rooftop_1"],
    "firstVisitXp": 100,
    "status": "draft"
  }
]
```

Rules:
- `phase`: `day` | `night` | `both`.
- `trackVisibility`: `all` | `vampire` | `detective`.
- `sceneOpener`: static text used when AI budget is out; otherwise the
  narrator may rewrite it with AI.
- `narration: false` = static, zero AI cost.
- **`meaningful`: only meaningful:true actions award 200 XP, and only
  ONCE per player per scene regardless of repeat clicks.**
- 11 entries at launch.

---

## `data/daytime_activities.json`
```json
[
  {
    "id": "school",
    "name": "School",
    "phase": "day",
    "opensThread": true,
    "npcs": ["mahiru", "akira"],
    "staticText": "The bell rings. Chalk dust in the light.",
    "actions": [
      { "id": "attend", "label": "Attend class", "narration": false, "meaningful": false, "xp": 40 },
      { "id": "hallway", "label": "Hallway talk", "narration": true, "meaningful": true, "xp": 20 },
      { "id": "skip", "label": "Skip class", "narration": false, "meaningful": false, "xp": 15 }
    ],
    "status": "draft"
  },
  {
    "id": "insomnia",
    "name": "Insomnia",
    "phase": "both",
    "opensThread": false,
    "npcs": [],
    "staticText": "The ceiling doesn't answer.",
    "actions": [
      { "id": "journal", "label": "Write in your journal", "narration": false, "meaningful": true, "xp": 30 },
      { "id": "phone", "label": "Check your phone", "narration": false, "meaningful": false, "xp": 10 },
      { "id": "stare", "label": "Stare at the ceiling", "narration": false, "meaningful": false, "xp": 5 }
    ],
    "status": "draft"
  }
]
```

Rules:
- `opensThread`: true for School, Work, Investigate. FALSE for Insomnia.
- `narration: false` = static, zero AI cost.
- `narration: true` = may call AI, but only if a core NPC is present.
- `meaningful: true` actions award 200 XP once per player per scene.
- Four entries at launch: school, work, insomnia, investigate.

---

## `data/quests.json`
```json
[
  {
    "id": "q_rooftop_1",
    "title": "The Thing on the Roof",
    "track": "any",
    "minLevel": 1,
    "source": "discovery",
    "location": "rooftop",
    "phase": "night",
    "completionRule": "both",
    "setsFlagOnComplete": null,
    "summary": "Something was left on the rooftop ledge.",
    "clues": [
      { "id": "c1", "text": "A torn receipt, 2:14 AM.", "location": "rooftop" },
      { "id": "c2", "text": "A faint smell of iron.", "location": "rooftop" },
      { "id": "c3", "text": "Scuff marks near the door.", "location": "rooftop" }
    ],
    "theories": [
      { "clues": ["c1", "c3"], "text": "Someone was here recently.", "correct": true }
    ],
    "rewards": { "xp": 400, "bond": { "nazuna": 10 } },
    "onComplete": "The rooftop goes quiet again. Whatever it was, it's gone now.",
    "status": "draft"
  }
]
```

Rules:
- `source`: `discovery` | `board` | `both`.
- `track`: `any` | `vampire` | `detective`.
- **`completionRule`: `allClues` | `correctTheory` | `both`. The engine
  reads this field. Most starter quests are "both".**
- **`setsFlagOnComplete`: `null` or a world flag name. When the quest
  completes, the named flag is set to true.**
- Theory matching is by exact clue-id set.
- 12+ starter quests drafted in Chunk 2.

---

## `data/events.json`
```json
{
  "trigger": {
    "checkEveryHours": 3,
    "minHoursBetweenEvents": 48,
    "maxEventsPerWeek": 2,
    "gateStuckDaysBeforeForce": 3,
    "safetyNetDays": 7
  },
  "windowHours": 2,
  "maxJoiners": 10,
  "templates": [
    {
      "id": "scream_district",
      "location": "love_hotel_district",
      "hook": "A scream from the love hotel district. Anko is already there — and she's not alone.",
      "choices": ["Go", "Watch from the rooftops"],
      "xp": 300,
      "status": "draft"
    }
  ]
}
```

Rules:
- `templates` are the ZERO-COST safety net. When AI is unavailable or the
  7-day safety net trips, the bot picks a template.
- AI only writes NEW event text. It never decides WHEN to fire.
- Events fire when: (a) time conditions are met AND (b) either a
  level-5-stuck player exists, OR 7+ days since last event, OR a
  world_flag with can_trigger_event=true is set.

---

## `data/progress_rewards.json`
```json
[
  { "level": 5,  "track": "vampire", "type": "tier",  "title": "Offspring", "ability": "Blood Sense" },
  { "level": 10, "track": "vampire", "type": "title", "title": "Night Student" },
  { "level": 10, "track": "vampire", "type": "perk",  "ability": "minor-perk-id" },
  { "level": 25, "track": "vampire", "type": "major", "ability": "major-ability-id" }
]
```

Rules:
- `type`: `tier` | `title` | `perk` | `major`.
- Tier entries must match `02_PROGRESSION_SPEC.md` exactly.
- Everything else is tunable content.

---

## `data/xp_curve.json`
```json
[
  { "fromLevel": 1,   "toLevel": 10,  "xpPerLevel": [80] },
  { "fromLevel": 11,  "toLevel": 30,  "xpPerLevel": [188] },
  { "fromLevel": 31,  "toLevel": 50,  "xpPerLevel": [540] },
  { "fromLevel": 51,  "toLevel": 75,  "xpPerLevel": [960] },
  { "fromLevel": 76,  "toLevel": 100, "xpPerLevel": [2128] },
  { "fromLevel": 101, "toLevel": 150, "xpPerLevel": [3200] },
  { "fromLevel": 151, "toLevel": 200, "xpPerLevel": [6000] }
]
```

Rules:
- One value = applies to every level in the band.
- Multiple values = interpolated linearly across the band.
- Single source of truth for level costs.
