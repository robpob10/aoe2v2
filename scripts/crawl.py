#!/usr/bin/env python3
"""
Crawl the Relic/WorldsEdge Community API for recent AoE2 2v2 ranked matches.
Outputs public/data/maps.json for the Next.js frontend.

Run locally:  python3 scripts/crawl.py
CI:           runs daily via .github/workflows/crawl.yml

Strategy:
  1. GET GetAvailableLeaderboards → civ ID→name table
  2. GET getLeaderBoard2 (team RM) → top SEED_PLAYERS profile_ids
  3. For each player: GET getRecentMatchHistory, keep matchtype_id=7 (2v2 RM)
     within the last DAYS_BACK days, dedup by match id
  4. For each unique match extract 4 players → 2 civ pairs → aggregate
  5. Write maps.json
"""

import datetime
import json
import time
from collections import defaultdict
from pathlib import Path

import requests

# ── Config ────────────────────────────────────────────────────────────────────
API_BASE = "https://aoe-api.worldsedgelink.com/community/leaderboard"
LEADERBOARD_ID = 4      # TEAM_RM_RANKED (2v2/3v3/4v4 combined)
MATCH_TYPE_2V2 = 7      # 2v2 RM ranked
SEED_PLAYERS = 1000     # Top-N leaderboard players to seed from
DAYS_BACK = 30          # Rolling window
REQUEST_DELAY = 0.35    # ~170 req/min, under the 200/min rate limit
MIN_MAP_APPEARANCES = 30
TOP_N = 20
OUTPUT_PATH = Path("public/data/maps.json")

SESSION = requests.Session()
SESSION.headers["User-Agent"] = "aoe2v2-stats/1.0 (github.com/robpob10/aoe2v2)"


# ── API helpers ───────────────────────────────────────────────────────────────

def get_civ_map() -> dict[int, str]:
    """Fetch civilization ID → name from the metadata endpoint."""
    resp = SESSION.get(
        f"{API_BASE}/GetAvailableLeaderboards",
        params={"title": "age2"},
        timeout=15,
    )
    resp.raise_for_status()
    races = resp.json().get("races", [])
    return {r["id"]: r["name"] for r in races}


def fetch_leaderboard_page(start: int, count: int = 200) -> list[int]:
    """Return profile_ids for one page of the team RM leaderboard, in rank order."""
    resp = SESSION.get(
        f"{API_BASE}/getLeaderBoard2",
        params={
            "title": "age2",
            "leaderboard_id": LEADERBOARD_ID,
            "platform": "PC_STEAM",
            "sortBy": 1,
            "start": start,
            "count": count,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    # statGroups and leaderboardStats are parallel arrays joined by statgroup_id
    sg_to_profiles: dict[int, list[int]] = {
        sg["id"]: [m["profile_id"] for m in sg.get("members", [])]
        for sg in data.get("statGroups", [])
    }
    return [
        pid
        for stat in data.get("leaderboardStats", [])
        for pid in sg_to_profiles.get(stat["statgroup_id"], [])
    ]


def fetch_match_history(profile_id: int) -> list[dict]:
    """Return up to 80 recent matches for a player (API returns ~10 per match type)."""
    resp = SESSION.get(
        f"{API_BASE}/getRecentMatchHistory",
        params={
            "title": "age2",
            "profile_ids": json.dumps([profile_id]),
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json().get("matchHistoryStats", [])


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    cutoff_ts = int(
        (datetime.datetime.utcnow() - datetime.timedelta(days=DAYS_BACK)).timestamp()
    )

    # 1. Civ metadata ─────────────────────────────────────────────────────────
    print("Fetching civ metadata …")
    civ_map = get_civ_map()
    print(f"  {len(civ_map)} civs loaded")
    time.sleep(REQUEST_DELAY)

    # 2. Seed player list ─────────────────────────────────────────────────────
    print(f"\nFetching top {SEED_PLAYERS} team RM players …")
    seed_ids: list[int] = []
    for start in range(1, SEED_PLAYERS + 1, 200):
        batch = fetch_leaderboard_page(start, min(200, SEED_PLAYERS - len(seed_ids)))
        seed_ids.extend(batch)
        print(f"  Ranks {start}–{start + len(batch) - 1}: {len(batch)} players")
        time.sleep(REQUEST_DELAY)
        if len(seed_ids) >= SEED_PLAYERS:
            break
    print(f"  Total seed players: {len(seed_ids)}")

    # 3. Crawl match histories ────────────────────────────────────────────────
    print(f"\nCrawling match histories ({DAYS_BACK}-day window) …")
    seen: set[int] = set()
    # (map_key, civ1, civ2) → {games, wins}
    stats: dict[tuple, dict] = defaultdict(lambda: {"games": 0, "wins": 0})

    for i, pid in enumerate(seed_ids):
        if i % 100 == 0:
            print(f"  [{i}/{len(seed_ids)}] {len(seen)} unique 2v2 matches so far")
        try:
            matches = fetch_match_history(pid)
        except requests.RequestException as exc:
            print(f"  WARN: profile {pid} failed — {exc}")
            time.sleep(2)
            continue

        for match in matches:
            if match.get("matchtype_id") != MATCH_TYPE_2V2:
                continue
            if match.get("startgametime", 0) < cutoff_ts:
                continue

            mid = match["id"]
            if mid in seen:
                continue
            seen.add(mid)

            members = match.get("matchhistoryreportresults", [])
            if len(members) != 4:
                continue

            # Group into two teams
            teams: dict[int, list[dict]] = defaultdict(list)
            for m in members:
                teams[m["teamid"]].append(m)
            if len(teams) != 2:
                continue
            team_lists = list(teams.values())
            if len(team_lists[0]) != 2 or len(team_lists[1]) != 2:
                continue

            # Strip .rms2 / .rms suffix and normalise to lowercase
            map_key = match.get("mapname", "unknown").split(".")[0].lower()

            for team in team_lists:
                civs = sorted(
                    civ_map.get(m["civilization_id"], f"civ_{m['civilization_id']}")
                    for m in team
                )
                won = any(m["resulttype"] == 1 for m in team)
                key = (map_key, civs[0], civs[1])
                stats[key]["games"] += 1
                if won:
                    stats[key]["wins"] += 1

        time.sleep(REQUEST_DELAY)

    print(f"\n  Total unique 2v2 matches: {len(seen)}")

    # 4. Aggregate per map ────────────────────────────────────────────────────
    print("Aggregating …")
    map_rows: dict[str, list] = defaultdict(list)
    for (map_key, civ1, civ2), s in stats.items():
        map_rows[map_key].append((civ1, civ2, s["games"], s["wins"]))

    output: dict = {
        "crawled_at": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "days_back": DAYS_BACK,
        "total_matches": len(seen),
        "maps": {},
    }

    for map_key, rows in sorted(map_rows.items()):
        total = sum(r[2] for r in rows)
        if total < MIN_MAP_APPEARANCES:
            continue
        top = sorted(rows, key=lambda r: r[2], reverse=True)[:TOP_N]
        output["maps"][map_key] = {
            "total_appearances": total,
            "teams": [
                {
                    "civs": [r[0], r[1]],
                    "games": r[2],
                    "wins": r[3],
                    "playrate": round(r[2] / total, 6),
                    "winrate": round(r[3] / r[2], 4),
                }
                for r in top
            ],
        }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(
        f"\nSaved {len(output['maps'])} maps → {OUTPUT_PATH}\n"
        f"Matches: {output['total_matches']:,}  |  Date: {output['crawled_at']}"
    )


if __name__ == "__main__":
    main()
