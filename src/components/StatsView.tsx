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
  if (pct >= 53) return '#00b894';
  if (pct >= 50) return '#00cec9';
  if (pct >= 47) return '#b2bec3';
  if (pct >= 44) return '#fdcb6e';
  return '#ff7675';
}

function winRateBg(pct: number): string {
  if (pct >= 53) return '#00b894';
  if (pct >= 50) return '#00cec9';
  if (pct >= 47) return '#636e72';
  if (pct >= 44) return '#e17055';
  return '#d63031';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WinRateCell({ pct }: { pct: number }) {
  const barWidth = Math.min(Math.max((pct - 40) / 20, 0), 1) * 100;
  return (
    <div className="flex items-center gap-2 justify-end">
      <span
        className="font-mono font-semibold tabular-nums w-12 text-right text-sm"
        style={{ color: winRateColor(pct) }}
      >
        {pct.toFixed(1)}%
      </span>
      <div
        className="w-14 h-1.5 rounded-full overflow-hidden shrink-0"
        style={{ background: 'rgba(255,255,255,0.1)' }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${barWidth}%`, background: winRateBg(pct) }}
        />
      </div>
    </div>
  );
}

function TeamRow({ rank, team }: { rank: number; team: TeamStat }) {
  const winPct = team.winrate * 100;
  const playPct = (team.playrate * 100).toFixed(2);

  return (
    <tr
      className="border-b transition-colors"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
    >
      <td className="py-3 px-4 font-mono text-xs tabular-nums w-8" style={{ color: 'rgba(255,255,255,0.3)' }}>
        {rank}
      </td>
      <td className="py-3 px-4 font-medium" style={{ minWidth: '260px', color: '#eee' }}>
        {team.civs[0]}
        <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 6px' }}>+</span>
        {team.civs[1]}
      </td>
      <td className="py-3 px-4 text-right font-mono tabular-nums text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {team.games.toLocaleString()}
      </td>
      <td className="py-3 px-4 text-right font-mono tabular-nums text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
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
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider w-8" style={{ color: 'rgba(255,255,255,0.45)' }}>#</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Team</th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Games</th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Play Rate</th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Win Rate</th>
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

            <p className="text-xs mt-2.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Play rate = share of all 2v2 team slots on this map. Win rate = games won by this civ pair.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
