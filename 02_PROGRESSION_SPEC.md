# PROGRESSION SPEC — LOCKED

## Tiers

### Vampire track
| Level | Tier |
|-------|------|
| 1     | Human |
| 5     | Offspring (choose sire) |
| 40    | Night-touched (hunger begins) |
| 70    | Half vampire / half human |
| 100   | Vampire |

### Detective track
| Level | Tier |
|-------|------|
| 1     | Human |
| 10    | Passionate detective novels reader |
| 30    | Cadet detective |
| 50    | Anko's secondary assistant |
| 75    | Anko's main assistant |
| 100   | Vampire hunter |

### Both tracks
| Level | Tier |
|-------|------|
| 200   | Half vampire and Anko's manager |

## Pacing targets
- Cadence assumption: 30 play sessions per month.
- Level 100 ≈ 120 sessions ≈ 4 months.
- Level 200 ≈ 180 sessions ≈ 6 months.
- Levels 101–200 therefore take ~60 sessions.
- Implement with XP NUMBERS ONLY. No timers, no calendar logic.

## XP curve (exact)
| Band | Levels | Sessions | XP/session | XP/level | Band total |
|------|--------|----------|------------|----------|------------|
| 1–10   | 10  | 12  | ~67    | 80    | 800     |
| 11–30  | 20  | 22  | ~170   | 188   | 3,750   |
| 31–50  | 20  | 27  | ~400   | 540   | 10,800  |
| 51–75  | 25  | 30  | ~800   | 960   | 24,000  |
| 76–100 | 25  | 29  | ~1,835 | 2,128 | 53,200  |
| 1→100  | 100 | 120 | —      | —     | ~92,550 |
| 101–150| 50  | 30  | ~5,333 | 3,200 | 160,000 |
| 151–200| 50  | 30  | ~10,000| 6,000 | 300,000 |
| 100→200| 100 | 60  | —      | —     | ~460,000|
| TOTAL  | 200 | 180 | —      | —     | ~552,550|

Cost per level rises in every band: 80 → 188 → 540 → 960 → 2,128 →
3,200 → 6,000. Higher tiers pay more XP per session, which is why the
endgame takes fewer sessions per level despite higher costs.

Store the XP curve as DATA (see `08_JSON_SCHEMAS.md`, `xp_curve.json`),
not as nested if/else logic.

## Both tracks use identical totals
Same 92,550 for 1→100, same 460,000 for 100→200.
Parity is enforced in the engine. Only the flavor of XP sources differs.

## Two XP sources at Level 101+
| Source | Share | How earned |
|--------|-------|------------|
| Night XP | ~60% | Normal high-tier play (arcs, hunts, cases, blood) |
| Mastery XP | ~40% | Major story beats only — NOT grindable |

- Mastery beats award 10,000–30,000 XP each.
- Mastery is a BOOSTER, not a gate. A pure grinder can still reach 200
  in ~50 sessions; a story-focused player in ~35.
- Level 200 triggers a server-wide announcement and a unique role.

## The Level 5 gate (vampire track)
- Reaching Level 5 on the vampire track does NOT advance the player to
  Level 6 until the activity gate is met (see 01_LOCKED_DECISIONS).
- XP continues to accumulate. When the gate is met, the sire selection
  interaction fires and the player becomes an offspring.
- Detective track has no equivalent gate at Level 5. It flows normally.

## Daily caps
| Cap | Value |
|-----|-------|
| Night XP per day | 20,000 |
| Mastery XP per day | 40,000 |
| Weekly soft cap | 90,000 (diminishing returns beyond) |
| Return bonus | 2× for 1 session after 3+ days away |

## Anti-grind rules
- Daily cap per XP source.
- First-time bonuses: new location, new clue, new NPC met = one-time XP.
- Streak multiplier for consecutive nights, capped.
- Diminishing returns for repeating the identical action.
- Detective: repeated case TYPES give less XP.
- Detective: clicking the same object twice gives 0.
- Detective: a wrong Notebook theory costs a cooldown, not XP.
- Cold case pool as evergreen content when current cases run out.

## Sub-milestones (config-driven)
Between named tiers, every level gives something small:
- small unlock every level
- a title every 5 levels
- a perk every 10 levels
- a major ability every 25 levels
Store these in `progress_rewards.json`. Not hardcoded.
