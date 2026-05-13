'use client';

import { useEffect, useRef, useState } from 'react';
import type { StatsData, TeamStat } from '@/lib/types';

// ── Image helpers ─────────────────────────────────────────────────────────────

const civIconUrl = (civ: string) =>
  `https://aoestats.io/assets/civ_crests/${civ.toLowerCase()}.webp`;
const civIconFallback = (civ: string) =>
  `https://raw.githubusercontent.com/SiegeEngineers/aoe2techtree/master/img/Civs/${civ.toLowerCase()}.png`;
const mapImgUrl = (mapKey: string) =>
  `https://www.aoe2insights.com/static/images/maps/${mapKey}.png`;

function CivIcon({ civ, size = 26 }: { civ: string; size?: number }) {
  const [src, setSrc] = useState(civIconUrl(civ));
  const usedFallback = useRef(false);
  return (
    <img
      src={src}
      alt={civ}
      width={size}
      height={size}
      className="rounded-full ring-1 ring-white/10 shrink-0 bg-stone-800"
      onError={() => {
        if (!usedFallback.current) {
          usedFallback.current = true;
          setSrc(civIconFallback(civ));
        }
      }}
    />
  );
}

function MapThumb({
  mapKey,
  width,
  height,
  className = '',
}: {
  mapKey: string;
  width: number;
  height: number;
  className?: string;
}) {
  const [show, setShow] = useState(true);
  if (!show) return <div style={{ width, height }} className="bg-stone-800 rounded shrink-0" />;
  return (
    <img
      src={mapImgUrl(mapKey)}
      alt={mapKey}
      width={width}
      height={height}
      className={`object-cover rounded shrink-0 ${className}`}
      onError={() => setShow(false)}
    />
  );
}

// ── Map name formatting ───────────────────────────────────────────────────────

const MAP_DISPLAY: Record<string, string> = {
  goldenpit: 'Golden Pit',
  land_nomad: 'Land Nomad',
  black_forest: 'Black Forest',
  hill_fort: 'Hill Fort',
  african_clearing: 'African Clearing',
  ghost_lake: 'Ghost Lake',
  four_lakes: 'Four Lakes',
  team_islands: 'Team Islands',
  gold_rush: 'Gold Rush',
  water_nomad: 'Water Nomad',
  seize_the_mountain: 'Seize the Mountain',
  mountain_ridge: 'Mountain Ridge',
  coastal_forest: 'Coastal Forest',
  wolf_hill: 'Wolf Hill',
  golden_swamp: 'Golden Swamp',
  bogland: 'Bogland',
  paradise_island: 'Paradise Island',
  fortified_clearing: 'Fortified Clearing',
};

function formatMapName(key: string): string {
  if (MAP_DISPLAY[key]) return MAP_DISPLAY[key];
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Win rate helpers ──────────────────────────────────────────────────────────

function winRateColor(pct: number): string {
  if (pct >= 56) return 'text-green-400';
  if (pct >= 53) return 'text-green-500/90';
  if (pct >= 50) return 'text-emerald-400/80';
  if (pct >= 47) return 'text-stone-300';
  if (pct >= 44) return 'text-orange-400';
  return 'text-red-400';
}

function winRateBg(pct: number): string {
  if (pct >= 56) return 'bg-green-500';
  if (pct >= 53) return 'bg-green-600';
  if (pct >= 50) return 'bg-emerald-700';
  if (pct >= 47) return 'bg-stone-600';
  if (pct >= 44) return 'bg-orange-700';
  return 'bg-red-700';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WinRateCell({ pct }: { pct: number }) {
  const barWidth = Math.min(Math.max((pct - 40) / 20, 0), 1) * 100;
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className={`font-mono font-semibold tabular-nums w-12 text-right text-sm ${winRateColor(pct)}`}>
        {pct.toFixed(1)}%
      </span>
      <div className="w-14 h-1.5 bg-stone-800 rounded-full overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full ${winRateBg(pct)}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

function TeamRow({ rank, team }: { rank: number; team: TeamStat }) {
  const winPct = team.winrate * 100;
  const playPct = (team.playrate * 100).toFixed(2);

  return (
    <tr className="border-b border-stone-800/50 hover:bg-stone-800/20 transition-colors">
      <td className="py-3 px-4 text-stone-600 font-mono text-xs tabular-nums">{rank}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2 flex-wrap">
          <CivIcon civ={team.civs[0]} size={26} />
          <span className="text-stone-200 text-sm">{team.civs[0]}</span>
          <span className="text-stone-700 text-xs mx-0.5">+</span>
          <CivIcon civ={team.civs[1]} size={26} />
          <span className="text-stone-200 text-sm">{team.civs[1]}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-right text-stone-400 font-mono tabular-nums text-sm">
        {team.games.toLocaleString()}
      </td>
      <td className="py-3 px-4 text-right text-stone-300 font-mono tabular-nums text-sm">
        {playPct}%
      </td>
      <td className="py-3 px-4 text-right">
        <WinRateCell pct={winPct} />
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StatsView() {
  const [data, setData] = useState<StatsData | null>(null);
  const [selectedMap, setSelectedMap] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/maps.json')
      .then((r) => {
        if (!r.ok) throw new Error('Data file not found — run: npm run fetch-data or python3 scripts/crawl.py');
        return r.json();
      })
      .then((d: StatsData) => {
        setData(d);
        const top = Object.entries(d.maps).sort(
          (a, b) => b[1].total_appearances - a[1].total_appearances,
        );
        if (top.length > 0) setSelectedMap(top[0][0]);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const sortedMaps = data
    ? Object.entries(data.maps).sort((a, b) => b[1].total_appearances - a[1].total_appearances)
    : [];

  const currentMap = data && selectedMap ? data.maps[selectedMap] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-amber-400 text-base animate-pulse">Loading match data…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-8">
        <div className="bg-stone-900 border border-red-900/60 rounded-xl p-8 max-w-lg text-center space-y-3">
          <div className="text-red-400 font-semibold text-lg">No data available</div>
          <div className="text-stone-400 text-sm font-mono bg-stone-950 rounded px-4 py-2">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-amber-400 tracking-tight">
              AoE2 2v2 Team Win Rates
            </h1>
            <p className="text-stone-500 text-xs mt-0.5">
              Ranked Random Map · 2v2 · {data?.total_matches.toLocaleString()} matches
            </p>
          </div>
          {data && (
            <div className="text-right shrink-0">
              <div className="text-stone-500 text-xs">Updated {data.crawled_at}</div>
              <div className="text-stone-600 text-xs mt-0.5">
                Rolling {data.days_back} days · live data
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Map tabs */}
        <div className="overflow-x-auto tabs-scroll pb-1">
          <div className="flex gap-2 min-w-max">
            {sortedMaps.map(([mapKey, mapData]) => {
              const active = selectedMap === mapKey;
              return (
                <button
                  key={mapKey}
                  onClick={() => setSelectedMap(mapKey)}
                  className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-amber-500 text-stone-950 shadow-sm'
                      : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200'
                  }`}
                >
                  <MapThumb mapKey={mapKey} width={48} height={36} className="rounded-md" />
                  <div className="text-left">
                    <div className="leading-tight">{formatMapName(mapKey)}</div>
                    <div className={`text-xs tabular-nums leading-tight ${active ? 'text-stone-800' : 'text-stone-600'}`}>
                      {(mapData.total_appearances / 1000).toFixed(1)}k
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected map hero */}
        {currentMap && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <MapThumb mapKey={selectedMap} width={80} height={60} className="rounded-lg ring-1 ring-stone-700" />
              <div>
                <h2 className="text-lg font-semibold text-stone-100">
                  {formatMapName(selectedMap)}
                </h2>
                <p className="text-stone-500 text-sm">
                  {currentMap.total_appearances.toLocaleString()} team appearances ·{' '}
                  Top {currentMap.teams.length} by play rate
                </p>
              </div>
            </div>

            <div className="bg-stone-900 rounded-xl border border-stone-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="border-b border-stone-800 bg-stone-900/50">
                      <th className="text-left py-2.5 px-4 text-stone-500 text-xs font-medium uppercase tracking-wider w-8">#</th>
                      <th className="text-left py-2.5 px-4 text-stone-500 text-xs font-medium uppercase tracking-wider">Team</th>
                      <th className="text-right py-2.5 px-4 text-stone-500 text-xs font-medium uppercase tracking-wider">Games</th>
                      <th className="text-right py-2.5 px-4 text-stone-500 text-xs font-medium uppercase tracking-wider">Play Rate</th>
                      <th className="text-right py-2.5 px-4 text-stone-500 text-xs font-medium uppercase tracking-wider pr-4">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMap.teams.map((team, i) => (
                      <TeamRow
                        key={`${team.civs[0]}-${team.civs[1]}`}
                        rank={i + 1}
                        team={team}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-stone-700 text-xs mt-3">
              Play rate = share of all 2v2 team slots on this map. Win rate = games won by this civ pair.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
