'use client';

import { useEffect, useState } from 'react';
import type { StatsData, TeamStat } from '@/lib/types';

// Custom display names for maps that need special casing
const MAP_DISPLAY: Record<string, string> = {
  goldenpit: 'Golden Pit',
  land_nomad: 'Land Nomad',
  black_forest: 'Black Forest',
  hill_fort: 'Hill Fort',
  african_clearing: 'African Clearing',
};

function formatMapName(key: string): string {
  if (MAP_DISPLAY[key]) return MAP_DISPLAY[key];
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Deterministic color per civ name
const CIV_PALETTES = [
  'bg-blue-900/70 text-blue-200 border-blue-700/40',
  'bg-emerald-900/70 text-emerald-200 border-emerald-700/40',
  'bg-amber-900/70 text-amber-200 border-amber-700/40',
  'bg-red-900/70 text-red-200 border-red-700/40',
  'bg-purple-900/70 text-purple-200 border-purple-700/40',
  'bg-teal-900/70 text-teal-200 border-teal-700/40',
  'bg-orange-900/70 text-orange-200 border-orange-700/40',
  'bg-indigo-900/70 text-indigo-200 border-indigo-700/40',
  'bg-rose-900/70 text-rose-200 border-rose-700/40',
  'bg-cyan-900/70 text-cyan-200 border-cyan-700/40',
  'bg-lime-900/70 text-lime-200 border-lime-700/40',
  'bg-sky-900/70 text-sky-200 border-sky-700/40',
];

function civColor(civ: string): string {
  const hash = civ.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return CIV_PALETTES[hash % CIV_PALETTES.length];
}

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

function CivBadge({ civ }: { civ: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded border text-xs font-medium tracking-wide ${civColor(civ)}`}
    >
      {civ}
    </span>
  );
}

function WinRateBar({ pct }: { pct: number }) {
  // Bar represents deviation from 50%, max shown at 60%
  const barWidth = Math.min(Math.max((pct - 40) / 20, 0), 1) * 100;
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className={`font-mono font-semibold tabular-nums w-12 text-right ${winRateColor(pct)}`}>
        {pct.toFixed(1)}%
      </span>
      <div className="w-16 h-1.5 bg-stone-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${winRateBg(pct)}`}
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
    <tr className="border-b border-stone-800/50 hover:bg-stone-800/20 transition-colors group">
      <td className="py-3 px-4 text-stone-600 font-mono text-xs tabular-nums w-8">{rank}</td>
      <td className="py-3 px-4">
        <div className="flex flex-wrap gap-2 items-center">
          <CivBadge civ={team.civs[0]} />
          <span className="text-stone-700 text-xs">+</span>
          <CivBadge civ={team.civs[1]} />
        </div>
      </td>
      <td className="py-3 px-4 text-right text-stone-400 font-mono tabular-nums text-sm">
        {team.games.toLocaleString()}
      </td>
      <td className="py-3 px-4 text-right text-stone-300 font-mono tabular-nums text-sm">
        {playPct}%
      </td>
      <td className="py-3 px-4 text-right">
        <WinRateBar pct={winPct} />
      </td>
    </tr>
  );
}

export default function StatsView() {
  const [data, setData] = useState<StatsData | null>(null);
  const [selectedMap, setSelectedMap] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/maps.json')
      .then((r) => {
        if (!r.ok) throw new Error('Data file not found — run: npm run fetch-data');
        return r.json();
      })
      .then((d: StatsData) => {
        setData(d);
        // Default to most popular map
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
          <p className="text-stone-500 text-xs">
            Run the fetch script to download and process match data from aoestats.io
          </p>
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
              Ranked Random Map · 2v2 · {data?.total_matches.toLocaleString()} matches analysed
            </p>
          </div>
          {data && (
            <div className="text-right shrink-0">
              <div className="text-stone-500 text-xs">Data through {data.dump_date}</div>
              <div className="text-stone-600 text-xs mt-0.5">All rated players · rolling 4 weeks</div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Map tabs */}
        <div className="overflow-x-auto tabs-scroll pb-1">
          <div className="flex gap-1.5 min-w-max">
            {sortedMaps.map(([mapKey, mapData]) => (
              <button
                key={mapKey}
                onClick={() => setSelectedMap(mapKey)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedMap === mapKey
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200'
                }`}
              >
                {formatMapName(mapKey)}
                <span
                  className={`ml-1.5 text-xs tabular-nums ${
                    selectedMap === mapKey ? 'text-stone-800' : 'text-stone-600'
                  }`}
                >
                  {(mapData.total_appearances / 1000).toFixed(1)}k
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {currentMap && (
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
              <h2 className="text-base font-semibold text-stone-100">
                Top {currentMap.teams.length} Teams on{' '}
                <span className="text-amber-400">{formatMapName(selectedMap)}</span>
              </h2>
              <span className="text-stone-500 text-sm">
                {currentMap.total_appearances.toLocaleString()} team appearances
              </span>
            </div>

            <div className="bg-stone-900 rounded-xl border border-stone-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[540px]">
                  <thead>
                    <tr className="border-b border-stone-800 bg-stone-900/50">
                      <th className="text-left py-2.5 px-4 text-stone-500 text-xs font-medium uppercase tracking-wider w-8">
                        #
                      </th>
                      <th className="text-left py-2.5 px-4 text-stone-500 text-xs font-medium uppercase tracking-wider">
                        Team
                      </th>
                      <th className="text-right py-2.5 px-4 text-stone-500 text-xs font-medium uppercase tracking-wider">
                        Games
                      </th>
                      <th className="text-right py-2.5 px-4 text-stone-500 text-xs font-medium uppercase tracking-wider">
                        Play Rate
                      </th>
                      <th className="text-right py-2.5 px-4 text-stone-500 text-xs font-medium uppercase tracking-wider pr-5">
                        Win Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMap.teams.map((team, i) => (
                      <TeamRow key={`${team.civs[0]}-${team.civs[1]}`} rank={i + 1} team={team} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-stone-700 text-xs mt-3">
              Play rate = share of all 2v2 team slots on this map. Win rate = percentage of games
              won by teams with this civ combination.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
