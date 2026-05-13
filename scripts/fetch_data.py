#!/usr/bin/env python3
"""
Fetch and process AoE2 2v2 team win-rate data from aoestats.io weekly Parquet dumps.

Outputs: public/data/maps.json  (read by the Next.js frontend)

Usage:
    python3 scripts/fetch_data.py
"""

import json
import os
import sys
from pathlib import Path

import pandas as pd
import requests


DUMPS_API = "https://aoestats.io/api/db_dumps"
BASE_URL = "https://aoestats.io"
CACHE_DIR = Path(".data_cache")
OUTPUT_PATH = Path("public/data/maps.json")

# How many of the most recent non-empty weekly dumps to combine.
# More weeks = larger sample size but longer download time.
WEEKS_TO_USE = 4

# 2v2 Random Map leaderboard match type on aoestats.io
# raw_match_type 7  = 2v2 RM (standard)
# raw_match_type 67 = 2v2 RM (controller variant)
RM_2V2_TYPES = {7, 67}


def get_recent_dumps(n: int) -> list[dict]:
    """Return the N most recent weekly dumps that actually contain data."""
    print("Fetching dump index from aoestats.io …")
    resp = requests.get(DUMPS_API, timeout=30)
    resp.raise_for_status()
    payload = resp.json()

    all_dumps = payload.get("db_dumps", payload) if isinstance(payload, dict) else payload
    with_data = [d for d in all_dumps if d.get("num_matches", 1) > 0]
    recent = sorted(with_data, key=lambda d: d.get("end_date", ""), reverse=True)[:n]

    if not recent:
        print("ERROR: No usable dumps found", file=sys.stderr)
        sys.exit(1)

    print(f"  Using {len(recent)} most recent dump(s):")
    for d in recent:
        print(f"    {d['start_date']} → {d['end_date']}  ({d['num_matches']:,} matches)")

    # Make URLs absolute
    for d in recent:
        for key in ("matches_url", "players_url"):
            if d[key].startswith("/"):
                d[key] = BASE_URL + d[key]

    return recent


def download_file(url: str, dest: Path) -> None:
    if dest.exists():
        print(f"  Using cached: {dest.name}")
        return
    print(f"  Downloading {dest.name} …", end="", flush=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=600) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", 0))
        downloaded = 0
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=65_536):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded / total * 100
                    print(f"\r  Downloading {dest.name} … {pct:.0f}%", end="", flush=True)
    print(f"\r  Downloaded {dest.name} ({downloaded / 1_048_576:.1f} MB)   ")


def main() -> None:
    CACHE_DIR.mkdir(exist_ok=True)

    # ── 1. Get recent dump URLs ───────────────────────────────────────────────
    dumps = get_recent_dumps(WEEKS_TO_USE)
    latest_end_date = dumps[0]["end_date"]

    # ── 2. Download Parquet files ─────────────────────────────────────────────
    print("\nDownloading data files …")
    matches_frames: list[pd.DataFrame] = []
    players_frames: list[pd.DataFrame] = []

    for dump in dumps:
        date_tag = dump["end_date"].replace("-", "")
        matches_path = CACHE_DIR / f"matches_{date_tag}.parquet"
        players_path = CACHE_DIR / f"players_{date_tag}.parquet"
        download_file(dump["matches_url"], matches_path)
        download_file(dump["players_url"], players_path)
        matches_frames.append(
            pd.read_parquet(
                matches_path,
                columns=["game_id", "map", "num_players", "raw_match_type"],
            )
        )
        players_frames.append(
            pd.read_parquet(
                players_path,
                columns=["game_id", "civ", "winner", "team", "old_rating"],
            )
        )

    # ── 3. Combine weeks ──────────────────────────────────────────────────────
    print("\nCombining data …")
    matches_df = pd.concat(matches_frames, ignore_index=True).drop_duplicates("game_id")
    players_df = pd.concat(players_frames, ignore_index=True).drop_duplicates(
        subset=["game_id", "team", "civ"]
    )
    print(f"  Total rows: {len(matches_df):,}")

    # Diagnostic: show match type distribution for 4-player games
    four_player = matches_df[matches_df["num_players"] == 4]
    print(
        "  raw_match_type distribution (4-player):\n"
        + four_player["raw_match_type"]
        .value_counts()
        .head(10)
        .to_string(header=False)
        .replace("\n", "\n    ")
    )

    # ── 4. Filter to 2v2 Random Map ───────────────────────────────────────────
    matches_2v2 = matches_df[
        (matches_df["num_players"] == 4)
        & (matches_df["raw_match_type"].isin(RM_2V2_TYPES))
    ].copy()
    print(f"\n  2v2 RM matches (types {RM_2V2_TYPES}): {len(matches_2v2):,}")

    if matches_2v2.empty:
        print(
            "  WARNING: strict type filter yielded 0 rows. "
            "Falling back to all 4-player games."
        )
        matches_2v2 = four_player.copy()

    # ── 5. Filter players: drop any game containing a player with rating < 1200 ─
    print(f"\n  Total player rows: {len(players_df):,}")
    game_ids_2v2 = set(matches_2v2["game_id"])
    players_2v2 = players_df[players_df["game_id"].isin(game_ids_2v2)].copy()

    low_elo_games = set(
        players_2v2.loc[players_2v2["old_rating"] < 1200, "game_id"]
    )
    print(f"  Games with a player rated <1200: {len(low_elo_games):,} (dropping)")

    matches_filtered = matches_2v2[~matches_2v2["game_id"].isin(low_elo_games)].copy()
    print(f"  Matches after elo filter: {len(matches_filtered):,}")

    game_ids = set(matches_filtered["game_id"])
    players_filtered = players_2v2[players_2v2["game_id"].isin(game_ids)].copy()
    print(f"  Player rows after elo filter: {len(players_filtered):,}")

    # ── 6. Join ───────────────────────────────────────────────────────────────
    print("\nJoining match metadata to player rows …")
    merged = matches_filtered[["game_id", "map"]].merge(
        players_filtered, on="game_id", how="inner"
    )

    # ── 7. Build per-team rows (one row = one team's civ pair + result) ───────
    print("Extracting team compositions …")

    # Sort civs within each (game_id, team) group so civ1 <= civ2 alphabetically
    merged_sorted = merged.sort_values(["game_id", "team", "civ"])
    merged_sorted["rank_in_team"] = (
        merged_sorted.groupby(["game_id", "team"]).cumcount()
    )

    # Keep only positions 0 and 1 (exactly 2 players per team)
    pos0 = merged_sorted[merged_sorted["rank_in_team"] == 0][
        ["game_id", "map", "team", "civ", "winner"]
    ].rename(columns={"civ": "civ1"})
    pos1 = merged_sorted[merged_sorted["rank_in_team"] == 1][
        ["game_id", "team", "civ"]
    ].rename(columns={"civ": "civ2"})

    team_df = pos0.merge(pos1, on=["game_id", "team"], how="inner")

    # Verify correct player count: drop any game+team that had ≠2 players
    team_sizes = (
        merged_sorted.groupby(["game_id", "team"]).size().reset_index(name="n")
    )
    valid = team_sizes[team_sizes["n"] == 2][["game_id", "team"]]
    team_df = team_df.merge(valid, on=["game_id", "team"], how="inner")

    print(f"  Team appearances: {len(team_df):,}")

    # ── 8. Aggregate by map + civ pair ────────────────────────────────────────
    print("\nAggregating stats …")
    agg = (
        team_df.groupby(["map", "civ1", "civ2"], observed=True)
        .agg(games=("winner", "count"), wins=("winner", "sum"))
        .reset_index()
    )

    # ── 9. Build output JSON ──────────────────────────────────────────────────
    output: dict = {
        "dump_date": latest_end_date,
        "total_matches": len(matches_filtered),
        "maps": {},
    }

    for map_name, map_rows in agg.groupby("map", observed=True):
        map_rows = map_rows.copy()
        total_appearances = int(map_rows["games"].sum())

        if total_appearances < 50:
            continue  # skip maps with negligible data

        map_rows["playrate"] = map_rows["games"] / total_appearances
        map_rows["winrate"] = map_rows["wins"] / map_rows["games"]

        top20 = map_rows.nlargest(20, "playrate")

        output["maps"][str(map_name)] = {
            "total_appearances": total_appearances,
            "teams": [
                {
                    "civs": [row["civ1"], row["civ2"]],
                    "games": int(row["games"]),
                    "wins": int(row["wins"]),
                    "playrate": round(float(row["playrate"]), 6),
                    "winrate": round(float(row["winrate"]), 4),
                }
                for _, row in top20.iterrows()
            ],
        }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(
        f"\nSaved {len(output['maps'])} maps → {OUTPUT_PATH}\n"
        f"Matches: {output['total_matches']:,}"
    )


if __name__ == "__main__":
    main()
