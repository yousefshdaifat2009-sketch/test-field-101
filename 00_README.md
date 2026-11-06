# Call of the Night — Discord Game
## Project Brief

This repo contains the design docs and code for a Discord bot that turns 
ONE channel of a normal Discord server into a persistent, game-like night 
city inspired by the anime *Call of the Night*. 

## The Stack
- Cloudflare Workers (TypeScript)
- Cloudflare D1 (SQLite)
- Groq API (free tier)
- discord-interactions library (NOT discord.js)

## Time
- All game time is Tokyo time (JST, UTC+9, no DST).
- NIGHT: 18:00–06:00 JST. DAY: 06:00–18:00 JST.

## The one-line pitch
A quiet city you can walk into every night, where the people remember you,
the progress is slow and real, and nothing ever ends.

## File map
| File | Contents |
|------|----------|
| 00_README.md | This file — read first |
| 01_LOCKED_DECISIONS.md | Every confirmed design decision |
| 02_PROGRESSION_SPEC.md | Leveling, XP math, tiers |
| 03_WORLD_RULES.md | Hard narrative constraints |
| 04_OPEN_QUESTIONS.md | Undecided items |
| 05_TECH_STACK.md | Cloudflare, D1, Groq, cron, patterns |
| 06_COST_RULES.md | $0 budget rules |
| 07_BUILD_ORDER.md | Strict build sequence (Chunks 1–10) |
| 08_JSON_SCHEMAS.md | Data file schemas |
