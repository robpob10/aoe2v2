export interface TeamStat {
  civs: [string, string];
  games: number;
  wins: number;
  playrate: number;
  winrate: number;
}

export interface MapData {
  total_appearances: number;
  teams: TeamStat[];
}

export interface StatsData {
  crawled_at: string;
  days_back: number;
  total_matches: number;
  maps: Record<string, MapData>;
}
