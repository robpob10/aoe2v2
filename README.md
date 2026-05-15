# AoE2 2v2 Team Win Rates

Live win-rate stats for 2v2 ranked random map, broken down by map and civ pair.

**Live site:** https://aoe2v2.vercel.app

---

## What it shows

- Win rates for every civ pair combination on each map
- Data from players with team ELO ≥ 1200 (Team RM leaderboard)
- The highlighted combo at the top is the highest win rate among the 20 most-played pairs on the selected map

## How the data is collected

`scripts/crawl.py` hits the public Relic/WorldsEdge community API (no auth required):

1. **Leaderboard** — pages through `getLeaderBoard2` (leaderboard_id=4, Team RM) to collect all player profile IDs with team ELO ≥ 1200
2. **Match history** — calls `getRecentMatchHistory` for each player; filters to 2v2 RM ranked (matchtype_id=7)
3. **Deduplication** — a `seen` set of match IDs ensures each game is counted once even when multiple players from the same match are crawled
4. **Output** — writes `public/data/maps.json` consumed directly by the Next.js frontend

State is persisted in `.data_cache/crawl_state.pkl` between batch runs so deduplication is preserved across sessions.

### Daily CI

`.github/workflows/crawl.yml` runs the crawler daily at 04:00 UTC, covering the top 3000 players, and commits updated data.

### Manual / backfill runs

```bash
# Single batch (500 players starting at rank 500)
python3 scripts/crawl.py --start-rank 500

# Larger batch
python3 scripts/crawl.py --start-rank 0 --count 3000

# Wipe state and start fresh
python3 scripts/crawl.py --fresh
```

## Stack

- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS
- **Data:** Python crawler → static `maps.json` → served as a public asset
- **Hosting:** Vercel
- **CI:** GitHub Actions

## Local dev

```bash
npm install
npm run dev
```

To populate data locally:

```bash
pip install requests
python3 scripts/crawl.py --count 500
```
