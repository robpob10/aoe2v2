#!/usr/bin/env python3
"""
Crawl the Relic/WorldsEdge Community API for recent AoE2 2v2 ranked matches.
Outputs public/data/maps.json for the Next.js frontend.

Run locally:  python3 scripts/crawl.py
Batch mode:   python3 scripts/crawl.py --start-rank 500
              python3 scripts/crawl.py --start-rank 1000  ... etc
CI:           python3 scripts/crawl.py --count 3000
              (runs daily via .github/workflows/crawl.yml)

Batch runs accumulate into a shared state cache (.data_cache/crawl_state.pkl)
so match deduplication is preserved across batches.  Pass --fresh to wipe the
cache and start over.
"""

import argparse
import datetime
import json
import pickle
import time
from collections import defaultdict
from pathlib import Path

import requests

# ── Config ──────────────────────────────────────────────────────────────────────────────
API_BASE = "https://aoe-api.worldsedgelink.com/community/leaderboard"
LEADERBOARD_ID = 4      # TEAM_RM_RANKED — ratings here are team ELO
MATCH_TYPE_2V2 = 7      # 2v2 RM ranked
DAYS_BACK = 30          # Rolling window
MIN_ELO = 1400          # Team ELO floor (leaderboard_id=4 ratings)
BATCH_SIZE = 500        # Players per batch
REQUEST_DELAY = 0.35    # ~170 req/min, under the 200/min rate limit
MIN_MAP_APPEARANCES = 10
TOP_N = 20
OUTPUT_PATH = Path("public/data/maps.json")
STATE_PATH = Path(".data_cache/crawl_state.pkl")
CHECKPOINT_EVERY = 500

SESSION = requests.Session()
SESSION.headers["User-Agent"] = "aoe2v2-stats/1.0 (github.com/robpob10/aoe2v2)"


# ── API helpers ─────────────────────────────────────────────────────────────────────────

def get_civ_map() -> dict[int, str]:
    resp = SESSION.get(
        f"{API_BASE}/GetAvailableLeaderboards",
        params={"title": "age2"},
        timeout=15,
    )
    resp.raise_for_status()
    races = resp.json().get("races", [])
    return {r["id"]: r["name"] for r in races}


def fetch_leaderboard_page(start: int, count: int = 200) -> list[tuple[int, int]]:
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
    sg_to_profiles: dict[int, list[int]] = {
        sg["id"]: [m["profile_id"] for m in sg.get("members", [])]
        for sg in data.get("statGroups", [])
    }
    return [
        (pid, stat.get("rating", 0))
        for stat in data.get("leaderboardStats", [])
        for pid in sg_to_profiles.get(stat["statgroup_id"], [])
    ]


def fetch_match_history(profile_id: int) -> list[dict]:
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


# ── State persistence ────────────────────────────────────────────────────────────────────────────

def load_state() -> tuple[set, dict]:
    if STATE_PATH.exists():
        with open(STATE_PATH, "rb") as f:
            state = pickle.load(f)
        seen = state["seen"]
        stats = state["stats"]
        print(f"  Loaded state: {len(seen):,} seen matches, {len(stats):,} civ-pair keys")
    else:
        seen = set()
        stats = defaultdict(lambda: {"games": 0, "wins": 0})
        print("  No existing state — starting fresh")
    return seen, stats


def save_state(seen: set, stats: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_PATH, "wb") as f:
        pickle.dump({"seen": seen, "stats": dict(stats)}, f)


# ── Output ──────────────────────────────────────────────────────────────────────────────

def write_output(stats: dict, seen: set, label: str = "") -> None:
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

    tag = f" [{label}]" if label else ""
    print(
        f"  Checkpoint{tag}: {len(output['maps'])} maps, "
        f"{output['total_matches']:,} matches → {OUTPUT_PATH}"
    )


# ── Main ─────────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-rank", type=int, default=0,
                        help="Skip the first N seed players (for batch runs)")
    parser.add_argument("--count", type=int, default=BATCH_SIZE,
                        help="Number of players to process in this batch")
    parser.add_argument("--fresh", action="store_true",
                        help="Wipe cached state and start over")
    args = parser.parse_args()

    cutoff_ts = int(
        (datetime.datetime.utcnow() - datetime.timedelta(days=DAYS_BACK)).timestamp()
    )

    # 1. Civ metadata ──────────────────────────────────────────────────────────────────
    print("Fetching civ metadata …")
    civ_map = get_civ_map()
    print(f"  {len(civ_map)} civs loaded")
    time.sleep(REQUEST_DELAY)

    # 2. Full seed player list (team ELO ≥ MIN_ELO) ───────────────────────────────────────────
    print(f"\nFetching team RM leaderboard (team ELO ≥ {MIN_ELO}) …")
    all_ids: list[int] = []
    start = 1
    while True:
        batch = fetch_leaderboard_page(start)
        if not batch:
            break
        above = [(pid, elo) for pid, elo in batch if elo >= MIN_ELO]
        all_ids.extend(pid for pid, _ in above)
        min_elo_in_page = min(elo for _, elo in batch)
        print(f"  Ranks {start}–{start + len(batch) - 1}: {len(above)}/{len(batch)} above {MIN_ELO} (min ELO {min_elo_in_page})")
        time.sleep(REQUEST_DELAY)
        if len(above) < len(batch):
            break
        start += len(batch)

    total_players = len(all_ids)
    batch_ids = all_ids[args.start_rank: args.start_rank + args.count]
    end_rank = args.start_rank + len(batch_ids)
    print(f"  Total eligible players: {total_players:,}  |  This batch: ranks {args.start_rank + 1}–{end_rank} ({len(batch_ids)} players)")

    if not batch_ids:
        print("  No players in this batch range — done.")
        return

    # 3. Load (or reset) accumulated state ───────────────────────────────────────────────
    print()
    if args.fresh:
        STATE_PATH.unlink(missing_ok=True)
        print("  Cleared state cache")
    seen, stats = load_state()

    # 4. Crawl this batch ────────────────────────────────────────────────────────────────────────
    print(f"\nCrawling match histories ({DAYS_BACK}-day window) …")
    for i, pid in enumerate(batch_ids):
        if i % 100 == 0:
            print(f"  [{i}/{len(batch_ids)}] {len(seen):,} unique 2v2 matches so far")
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
            teams: dict[int, list[dict]] = defaultdict(list)
            for m in members:
                teams[m["teamid"]].append(m)
            if len(teams) != 2:
                continue
            team_lists = list(teams.values())
            if len(team_lists[0]) != 2 or len(team_lists[1]) != 2:
                continue

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

        if (i + 1) % CHECKPOINT_EVERY == 0:
            save_state(seen, stats)
            write_output(stats, seen, label=f"rank {args.start_rank + i + 1}/{total_players}")

    print(f"\n  Batch done. Total unique 2v2 matches so far: {len(seen):,}")

    # 5. Save state + write final output ────────────────────────────────────────────────────
    save_state(seen, stats)
    write_output(stats, seen, label=f"ranks {args.start_rank + 1}–{end_rank} of {total_players}")
    print("Done.")


if __name__ == "__main__":
    main()
