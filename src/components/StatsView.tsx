'use client';

import { useEffect, useState } from 'react';
import type { StatsData, TeamStat } from '@/lib/types';

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
  const dev = pct - 50;
  const t = Math.min(Math.abs(dev) / 8, 1);
  const [nr, ng, nb] = [190, 195, 200];
  const [tr, tg, tb] = dev >= 0 ? [0, 200, 150] : [255, 90, 90];
  const r = Math.round(nr + (tr - nr) * t);
  const g = Math.round(ng + (tg - ng) * t);
  const b = Math.round(nb + (tb - nb) * t);
  return `rgb(${r},${g},${b})`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TeamRow({ team }: { team: TeamStat }) {
  const winPct = team.winrate * 100;
  const playPct = (team.playrate * 100).toFixed(1);

  return (
    <tr
      className="border-b transition-colors"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
    >
      <td className="py-2.5 px-2 font-medium text-sm" style={{ color: '#eee' }}>
        {team.civs[0]}
        <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 3px' }}>+</span>
        {team.civs[1]}
      </td>
      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {team.games}
      </td>
      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
        {playPct}%
      </td>
      <td className="py-2.5 px-2 text-right font-mono font-semibold tabular-nums text-sm" style={{ color: winRateColor(winPct) }}>
        {winPct.toFixed(1)}%
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
        if (!r.ok) throw new Error('Data file not found — run: python3 scripts/crawl.py');
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

  const pageBg = { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={pageBg}>
        <div className="text-base animate-pulse" style={{ color: '#00cec9' }}>Loading match data…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={pageBg}>
        <div
          className="rounded-xl p-8 max-w-lg text-center space-y-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,71,87,0.4)' }}
        >
          <div className="font-semibold text-lg" style={{ color: '#ff7675' }}>No data available</div>
          <div className="text-sm font-mono rounded px-4 py-2" style={{ color: '#b2bec3', background: 'rgba(0,0,0,0.3)' }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ ...pageBg, color: '#eee' }}>
      {/* Header */}
      <header
        className="border-b sticky top-0 z-10"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(26,26,46,0.95)', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: '#00cec9' }}>
              AoE2 2v2 Team Win Rates
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Ranked Random Map · 2v2 · {data?.total_matches.toLocaleString()} matches
            </p>
          </div>
          {data && (
            <div className="text-right shrink-0 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <div>Updated {data.crawled_at}</div>
              <div className="mt-0.5">Rolling {data.days_back} days · live data</div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* Map tabs */}
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-1.5 min-w-max flex-wrap">
            {sortedMaps.map(([mapKey]) => {
              const active = selectedMap === mapKey;
              return (
                <button
                  key={mapKey}
                  onClick={() => setSelectedMap(mapKey)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: active ? '#00cec9' : 'rgba(255,255,255,0.07)',
                    color: active ? '#1a1a2e' : 'rgba(255,255,255,0.6)',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.13)';
                      (e.currentTarget as HTMLButtonElement).style.color = '#eee';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)';
                    }
                  }}
                >
                  {formatMapName(mapKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        {currentMap && (
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-semibold" style={{ color: '#eee' }}>
                {formatMapName(selectedMap)}
              </h2>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {currentMap.total_appearances.toLocaleString()} team appearances
              </span>
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <th className="text-left py-2 px-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Team</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>G</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Play%</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMap.teams.map((team) => (
                      <TeamRow
                        key={`${team.civs[0]}-${team.civs[1]}`}
                        team={team}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs mt-2.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Play rate = share of all 2v2 team slots on this map. Win rate = games won by this civ pair.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
