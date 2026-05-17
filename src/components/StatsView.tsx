'use client';

import { useEffect, useMemo, useState } from 'react';
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

// ── Quotes ────────────────────────────────────────────────────────────────────

const AOE2_QUOTES = [
  'It depends',
  'Auto-everything',
  "Burgundians? They must be making Cavalier",
  'vulaluuu vulaluuu',
  'Larry will surely break the curse this time',
  'start the game already',
  'sec, need a wee',
  'masmorra pls wash your laundry',
];

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

  return (
    <tr
      className="border-b transition-colors"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
    >
      <td className="py-2.5 pl-4 pr-2 font-medium text-sm" style={{ color: '#eee' }}>
        {team.civs[0]}
        <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 3px' }}>+</span>
        {team.civs[1]}
      </td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {team.games}
      </td>
      <td className="py-2.5 pr-4 pl-3 text-right font-mono font-semibold tabular-nums text-sm" style={{ color: winRateColor(winPct) }}>
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
  const [quoteIndex] = useState(() => Math.floor(Math.random() * AOE2_QUOTES.length));

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

  const bestValueCombo = useMemo((): TeamStat | null => {
    if (!currentMap) return null;
    const top20 = [...currentMap.teams]
      .sort((a, b) => b.playrate - a.playrate)
      .slice(0, 10);
    return top20.reduce(
      (best, t) => (!best || t.winrate > best.winrate ? t : best),
      null as TeamStat | null,
    );
  }, [currentMap]);

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

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-5">
        {/* Quote banner — contained rectangle */}
        <div
          className="rounded-lg px-6 py-4 text-center"
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span className="text-base italic" style={{ color: '#f9ca24' }}>
            {AOE2_QUOTES[quoteIndex]}
          </span>
        </div>

        {/* Best value combo — no label, light grey */}
        {bestValueCombo && (
          <div className="text-center py-1">
            <span className="text-lg font-semibold" style={{ color: '#c8cdd2' }}>
              {bestValueCombo.civs[0]}
              <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 8px' }}>+</span>
              {bestValueCombo.civs[1]}
            </span>
            <span
              className="ml-4 font-mono font-bold text-lg"
              style={{ color: winRateColor(bestValueCombo.winrate * 100) }}
            >
              {(bestValueCombo.winrate * 100).toFixed(1)}%
            </span>
            <span className="ml-3 font-mono text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {bestValueCombo.games} games
            </span>
          </div>
        )}

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
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: '#eee' }}>
                {formatMapName(selectedMap)}
              </h2>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {currentMap.total_appearances.toLocaleString()} games
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
                      <th className="text-left py-3 pl-4 pr-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Team</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>#</th>
                      <th className="text-right py-3 pr-4 pl-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMap.teams.slice(0, 10).map((team) => (
                      <TeamRow
                        key={`${team.civs[0]}-${team.civs[1]}`}
                        team={team}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Footer info bar */}
        <p className="text-xs text-center pb-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
          2v2 winrate data · top 15,000 players · ~1250 ELO and above · last 180 days
        </p>
      </main>
    </div>
  );
}
