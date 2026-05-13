#!/usr/bin/env python3
"""
Merge historical aoestats data with live Relic API crawler data.

Reads:  public/data/maps_historical.json  (from fetch_data.py)
        public/data/maps_live.json         (from crawl.py)
Writes: public/data/maps.json
"""

import json
from collections import defaultdict
from pathlib import Path

HISTORICAL = Path("public/data/maps_historical.json")
LIVE = Path("public/data/maps_live.json")
OUTPUT = Path("public/data/maps.json")

TOP_N = 20
MIN_APPEARANCES = 50


def load(path: Path) -> dict:
    if not path.exists():
        print(f"  WARN: {path} not found, skipping")
        return {}
    with open(path) as f:
        return json.load(f)


def main() -> None:
    hist = load(HISTORICAL)
    live = load(LIVE)

    if not hist and not live:
        print("ERROR: no source data files found")
        return

    # Accumulate (map_key, civ1, civ2) → {games, wins}
    stats: dict[tuple, dict] = defaultdict(lambda: {"games": 0, "wins": 0})

    for label, source in [("historical", hist), ("live", live)]:
        n = 0
        for map_key, map_data in source.get("maps", {}).items():
            for team in map_data.get("teams", []):
                civs = sorted(team["civs"])
                key = (map_key, civs[0], civs[1])
                stats[key]["games"] += team["games"]
                stats[key]["wins"] += team["wins"]
                n += 1
        print(f"  {label}: {n} team-map entries loaded")

    # Build per-map rows
    map_rows: dict[str, list] = defaultdict(list)
    for (map_key, civ1, civ2), s in stats.items():
        map_rows[map_key].append((civ1, civ2, s["games"], s["wins"]))

    output_maps: dict = {}
    for map_key, rows in sorted(map_rows.items()):
        total = sum(r[2] for r in rows)
        if total < MIN_APPEARANCES:
            continue
        top = sorted(rows, key=lambda r: r[2], reverse=True)[:TOP_N]
        output_maps[map_key] = {
            "total_appearances": total,
            "teams": [
                {
                    "civs": [r[0], r[1]],
                    "games": r[2],
                    "wins": r[3],
                    "playrate": round(r[2] / total, 6),
                    "winrate": round(r[3] / r[2], 4) if r[2] > 0 else 0,
                }
                for r in top
            ],
        }

    output = {
        "crawled_at": live.get("crawled_at") or hist.get("crawled_at", "unknown"),
        "days_back": live.get("days_back", 30),
        "total_matches": live.get("total_matches", 0) + hist.get("total_matches", 0),
        "maps": output_maps,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(output, f, indent=2)

    print(
        f"\nSaved {len(output_maps)} maps → {OUTPUT}\n"
        f"Total matches: {output['total_matches']:,}  |  Date: {output['crawled_at']}"
    )


if __name__ == "__main__":
    main()
