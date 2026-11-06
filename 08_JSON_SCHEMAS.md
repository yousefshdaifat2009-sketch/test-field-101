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
