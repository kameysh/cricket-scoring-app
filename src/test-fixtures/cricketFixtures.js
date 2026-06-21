/**
 * Realistic test fixture for "K7 Trophy" — a 2-season series.
 *
 * Season 1 match: Super Kings vs Street Boyz
 *   Innings 1 (Super Kings bat): Kamesh 45(30), Divya 20*(15)  → 65/1
 *   Innings 2 (Street Boyz bat): Arjun 30*(25), Ravi 40*(30)  → 70/0  Street Boyz win
 *
 * Season 2 match: Super Kings vs Street Boyz (rematch)
 *   Innings 1 (Super Kings bat): Kamesh 60(40), Divya 8(10)   → 68/2
 *   Innings 2 (Street Boyz bat): Arjun 50(35), Ravi 15(12)   → 65/2  Super Kings win (by 3 runs)
 *
 * Expected series aggregates (both seasons combined):
 *   Kamesh : bat 105 runs, 2 inn, 0 NO, avg 52.5, SR 150.0, HS 60, 9×4s, 3×6s, 1 fifty
 *             bowl  3 wkts, 55 runs, 60 balls, avg 18.3, econ 5.5
 *   Divya  : bat  28 runs, 2 inn, 1 NO, avg 28.0, SR 93.3, HS 20, 3×4s
 *   Arjun  : bat  80 runs, 2 inn, 1 NO, avg 80.0, SR 133.3, HS 50, 7×4s, 1×6, 1 fifty
 *             bowl  5 wkts, 55 runs, 72 balls, avg 11.0, econ 4.6
 *   Ravi   : bat  55 runs, 2 inn, 1 NO, avg 55.0, HS 40, 6×4s, 2×6s
 *
 * Batting leaderboard order (by runs): Kamesh(105) > Arjun(80) > Ravi(55) > Divya(28)
 * Bowling leaderboard order (by wkts): Arjun(5) > Kamesh(3)
 */

// ── IDs ──────────────────────────────────────────────────────────────────────

export const IDS = {
  series:       'series-k7trophy',
  tournament1:  'tournament-s1',
  tournament2:  'tournament-s2',
  match1:       'match-s1',
  match2:       'match-s2',
  inn_s1_1:     'innings-s1-1',  // season 1, Team A batting
  inn_s1_2:     'innings-s1-2',  // season 1, Team B batting
  inn_s2_1:     'innings-s2-1',  // season 2, Team A batting
  inn_s2_2:     'innings-s2-2',  // season 2, Team B batting
  kamesh:       'player-kamesh',
  divya:        'player-divya',
  arjun:        'player-arjun',
  ravi:         'player-ravi',
};

// ── Core entities ─────────────────────────────────────────────────────────────

export const SERIES = { id: IDS.series, name: 'K7 Trophy', created_at: '2025-01-01T00:00:00Z' };

export const TOURNAMENTS = [
  { id: IDS.tournament1, name: 'K7 Trophy Season 1', series_id: IDS.series, status: 'completed', start_date: '2025-01-01' },
  { id: IDS.tournament2, name: 'K7 Trophy Season 2', series_id: IDS.series, status: 'completed', start_date: '2026-01-01' },
];

export const PLAYERS = [
  { id: IDS.kamesh, name: 'Kamesh', photo_url: null, role: 'all_rounder' },
  { id: IDS.divya,  name: 'Divya',  photo_url: null, role: 'batsman' },
  { id: IDS.arjun,  name: 'Arjun',  photo_url: null, role: 'all_rounder' },
  { id: IDS.ravi,   name: 'Ravi',   photo_url: null, role: 'batsman' },
];

export const MATCHES = [
  {
    id: IDS.match1, tournament_id: IDS.tournament1, status: 'completed',
    team1_name: 'Super Kings', team2_name: 'Street Boyz',
    winning_team_name: 'Street Boyz', result_type: 'runs',
    result_summary: 'Street Boyz won by 5 wickets',
    total_overs: 6, created_at: '2025-01-10T10:00:00Z',
  },
  {
    id: IDS.match2, tournament_id: IDS.tournament2, status: 'completed',
    team1_name: 'Super Kings', team2_name: 'Street Boyz',
    winning_team_name: 'Super Kings', result_type: 'runs',
    result_summary: 'Super Kings won by 3 runs',
    total_overs: 6, created_at: '2026-01-10T10:00:00Z',
  },
];

export const INNINGS = [
  { id: IDS.inn_s1_1, match_id: IDS.match1, innings_number: 1, batting_team: 1, total_runs: 65,  total_wickets: 1, total_legal_balls: 36 },
  { id: IDS.inn_s1_2, match_id: IDS.match1, innings_number: 2, batting_team: 2, total_runs: 70,  total_wickets: 0, total_legal_balls: 30 },
  { id: IDS.inn_s2_1, match_id: IDS.match2, innings_number: 1, batting_team: 1, total_runs: 68,  total_wickets: 2, total_legal_balls: 36 },
  { id: IDS.inn_s2_2, match_id: IDS.match2, innings_number: 2, batting_team: 2, total_runs: 65,  total_wickets: 2, total_legal_balls: 36 },
];

// ── player_tournament_stats ───────────────────────────────────────────────────

// Season 1 stats
export const TOURNAMENT_STATS_S1 = [
  {
    player_id: IDS.kamesh, tournament_id: IDS.tournament1,
    players: PLAYERS.find(p => p.id === IDS.kamesh),
    bat_matches: 1, bat_innings: 1, bat_not_outs: 0, bat_runs: 45, bat_balls: 30,
    bat_highest_score: 45, bat_fours: 4, bat_sixes: 1, bat_ducks: 0,
    bat_thirties: 1, bat_fifties: 0, bat_hundreds: 0, bat_dot_balls: 10,
    bat_ones: 5, bat_twos: 2, bat_threes: 0,
    bowl_matches: 1, bowl_innings: 1, bowl_legal_balls: 30, bowl_runs: 30,
    bowl_wickets: 1, bowl_maidens: 0, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0,
    bowl_best_wickets: 1, bowl_best_runs: 30,
    field_catches: 1, field_stumpings: 0, field_run_outs: 0,
  },
  {
    player_id: IDS.divya, tournament_id: IDS.tournament1,
    players: PLAYERS.find(p => p.id === IDS.divya),
    bat_matches: 1, bat_innings: 1, bat_not_outs: 1, bat_runs: 20, bat_balls: 15,
    bat_highest_score: 20, bat_fours: 2, bat_sixes: 0, bat_ducks: 0,
    bat_thirties: 0, bat_fifties: 0, bat_hundreds: 0, bat_dot_balls: 5,
    bat_ones: 4, bat_twos: 1, bat_threes: 0,
    bowl_matches: 0, bowl_innings: 0, bowl_legal_balls: 0, bowl_runs: 0,
    bowl_wickets: 0, bowl_maidens: 0, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0,
    bowl_best_wickets: 0, bowl_best_runs: 0,
    field_catches: 0, field_stumpings: 0, field_run_outs: 0,
  },
  {
    player_id: IDS.arjun, tournament_id: IDS.tournament1,
    players: PLAYERS.find(p => p.id === IDS.arjun),
    bat_matches: 1, bat_innings: 1, bat_not_outs: 1, bat_runs: 30, bat_balls: 25,
    bat_highest_score: 30, bat_fours: 3, bat_sixes: 0, bat_ducks: 0,
    bat_thirties: 1, bat_fifties: 0, bat_hundreds: 0, bat_dot_balls: 8,
    bat_ones: 6, bat_twos: 1, bat_threes: 0,
    bowl_matches: 1, bowl_innings: 1, bowl_legal_balls: 36, bowl_runs: 25,
    bowl_wickets: 2, bowl_maidens: 1, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0,
    bowl_best_wickets: 2, bowl_best_runs: 25,
    field_catches: 0, field_stumpings: 0, field_run_outs: 1,
  },
  {
    player_id: IDS.ravi, tournament_id: IDS.tournament1,
    players: PLAYERS.find(p => p.id === IDS.ravi),
    bat_matches: 1, bat_innings: 1, bat_not_outs: 1, bat_runs: 40, bat_balls: 30,
    bat_highest_score: 40, bat_fours: 4, bat_sixes: 1, bat_ducks: 0,
    bat_thirties: 1, bat_fifties: 0, bat_hundreds: 0, bat_dot_balls: 7,
    bat_ones: 5, bat_twos: 2, bat_threes: 0,
    bowl_matches: 0, bowl_innings: 0, bowl_legal_balls: 0, bowl_runs: 0,
    bowl_wickets: 0, bowl_maidens: 0, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0,
    bowl_best_wickets: 0, bowl_best_runs: 0,
    field_catches: 1, field_stumpings: 0, field_run_outs: 0,
  },
];

// Season 2 stats (Ravi played a smaller innings this time)
export const TOURNAMENT_STATS_S2 = [
  {
    player_id: IDS.kamesh, tournament_id: IDS.tournament2,
    players: PLAYERS.find(p => p.id === IDS.kamesh),
    bat_matches: 1, bat_innings: 1, bat_not_outs: 0, bat_runs: 60, bat_balls: 40,
    bat_highest_score: 60, bat_fours: 5, bat_sixes: 2, bat_ducks: 0,
    bat_thirties: 0, bat_fifties: 1, bat_hundreds: 0, bat_dot_balls: 8,
    bat_ones: 6, bat_twos: 2, bat_threes: 0,
    bowl_matches: 1, bowl_innings: 1, bowl_legal_balls: 30, bowl_runs: 25,
    bowl_wickets: 2, bowl_maidens: 1, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0,
    bowl_best_wickets: 2, bowl_best_runs: 25,
    field_catches: 0, field_stumpings: 0, field_run_outs: 1,
  },
  {
    player_id: IDS.divya, tournament_id: IDS.tournament2,
    players: PLAYERS.find(p => p.id === IDS.divya),
    bat_matches: 1, bat_innings: 1, bat_not_outs: 0, bat_runs: 8, bat_balls: 10,
    bat_highest_score: 8, bat_fours: 1, bat_sixes: 0, bat_ducks: 0,
    bat_thirties: 0, bat_fifties: 0, bat_hundreds: 0, bat_dot_balls: 6,
    bat_ones: 2, bat_twos: 0, bat_threes: 0,
    bowl_matches: 0, bowl_innings: 0, bowl_legal_balls: 0, bowl_runs: 0,
    bowl_wickets: 0, bowl_maidens: 0, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0,
    bowl_best_wickets: 0, bowl_best_runs: 0,
    field_catches: 0, field_stumpings: 0, field_run_outs: 0,
  },
  {
    player_id: IDS.arjun, tournament_id: IDS.tournament2,
    players: PLAYERS.find(p => p.id === IDS.arjun),
    bat_matches: 1, bat_innings: 1, bat_not_outs: 0, bat_runs: 50, bat_balls: 35,
    bat_highest_score: 50, bat_fours: 4, bat_sixes: 1, bat_ducks: 0,
    bat_thirties: 0, bat_fifties: 1, bat_hundreds: 0, bat_dot_balls: 9,
    bat_ones: 7, bat_twos: 1, bat_threes: 0,
    bowl_matches: 1, bowl_innings: 1, bowl_legal_balls: 36, bowl_runs: 30,
    bowl_wickets: 3, bowl_maidens: 0, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0,
    bowl_best_wickets: 3, bowl_best_runs: 30,
    field_catches: 1, field_stumpings: 0, field_run_outs: 0,
  },
  {
    player_id: IDS.ravi, tournament_id: IDS.tournament2,
    players: PLAYERS.find(p => p.id === IDS.ravi),
    bat_matches: 1, bat_innings: 1, bat_not_outs: 0, bat_runs: 15, bat_balls: 12,
    bat_highest_score: 15, bat_fours: 2, bat_sixes: 1, bat_ducks: 0,
    bat_thirties: 0, bat_fifties: 0, bat_hundreds: 0, bat_dot_balls: 4,
    bat_ones: 3, bat_twos: 0, bat_threes: 0,
    bowl_matches: 0, bowl_innings: 0, bowl_legal_balls: 0, bowl_runs: 0,
    bowl_wickets: 0, bowl_maidens: 0, bowl_four_wicket_hauls: 0, bowl_five_wicket_hauls: 0,
    bowl_best_wickets: 0, bowl_best_runs: 0,
    field_catches: 0, field_stumpings: 0, field_run_outs: 0,
  },
];

export const ALL_TOURNAMENT_STATS = [...TOURNAMENT_STATS_S1, ...TOURNAMENT_STATS_S2];

// ── Sample deliveries (Season 1, Innings 1: Kamesh bats vs Arjun bowling) ─────

export const DELIVERIES_S1_INN1 = [
  // Over 1 — Arjun bowling to Kamesh
  { innings_id: IDS.inn_s1_1, batsman_id: IDS.kamesh, bowler_id: IDS.arjun, runs_off_bat: 4, extra_type: null, is_wicket: false },
  { innings_id: IDS.inn_s1_1, batsman_id: IDS.kamesh, bowler_id: IDS.arjun, runs_off_bat: 1, extra_type: null, is_wicket: false },
  { innings_id: IDS.inn_s1_1, batsman_id: IDS.kamesh, bowler_id: IDS.arjun, runs_off_bat: 0, extra_type: null, is_wicket: false },
  { innings_id: IDS.inn_s1_1, batsman_id: IDS.kamesh, bowler_id: IDS.arjun, runs_off_bat: 6, extra_type: null, is_wicket: false },
  { innings_id: IDS.inn_s1_1, batsman_id: IDS.kamesh, bowler_id: IDS.arjun, runs_off_bat: 2, extra_type: null, is_wicket: false },
  { innings_id: IDS.inn_s1_1, batsman_id: IDS.kamesh, bowler_id: IDS.arjun, runs_off_bat: 0, extra_type: null, is_wicket: true, wicket_type: 'bowled' },
];

// Season 2 delivery — Arjun bowling to Kamesh (for H2H cross-season test)
export const DELIVERIES_S2_INN1 = [
  { innings_id: IDS.inn_s2_1, batsman_id: IDS.kamesh, bowler_id: IDS.arjun, runs_off_bat: 4, extra_type: null, is_wicket: false },
  { innings_id: IDS.inn_s2_1, batsman_id: IDS.kamesh, bowler_id: IDS.arjun, runs_off_bat: 0, extra_type: null, is_wicket: false },
  { innings_id: IDS.inn_s2_1, batsman_id: IDS.kamesh, bowler_id: IDS.arjun, runs_off_bat: 0, extra_type: null, is_wicket: true, wicket_type: 'caught' },
];

export const ALL_DELIVERIES = [...DELIVERIES_S1_INN1, ...DELIVERIES_S2_INN1];

// ── Expected series-aggregated results ────────────────────────────────────────

export const EXPECTED_SERIES_STATS = {
  [IDS.kamesh]: {
    bat_runs: 105, bat_innings: 2, bat_not_outs: 0, bat_balls: 70,
    bat_highest_score: 60,          // MAX(45, 60)
    bat_fours: 9, bat_sixes: 3,
    bat_thirties: 1, bat_fifties: 1, bat_hundreds: 0,
    bowl_wickets: 3, bowl_runs: 55, bowl_legal_balls: 60,
    bowl_maidens: 1, bat_matches: 2,
  },
  [IDS.divya]: {
    bat_runs: 28, bat_innings: 2, bat_not_outs: 1, bat_balls: 25,
    bat_highest_score: 20,           // MAX(20, 8)
    bat_fours: 3, bat_sixes: 0,
    bowl_wickets: 0, bat_matches: 2,
  },
  [IDS.arjun]: {
    bat_runs: 80, bat_innings: 2, bat_not_outs: 1, bat_balls: 60,
    bat_highest_score: 50,           // MAX(30, 50)
    bat_fours: 7, bat_sixes: 1,
    bat_thirties: 1, bat_fifties: 1,
    bowl_wickets: 5, bowl_runs: 55, bowl_legal_balls: 72,
    bowl_maidens: 1, bowl_best_wickets: 3, bat_matches: 2,
  },
  [IDS.ravi]: {
    bat_runs: 55, bat_innings: 2, bat_not_outs: 1, bat_balls: 42,
    bat_highest_score: 40,           // MAX(40, 15)
    bat_fours: 6, bat_sixes: 2,
    bat_thirties: 1, bat_fifties: 0,
    bowl_wickets: 0, bat_matches: 2,
  },
};

// Leaderboard ranking expectations
export const EXPECTED_BAT_RANK   = [IDS.kamesh, IDS.arjun, IDS.ravi, IDS.divya]; // by runs desc
export const EXPECTED_BOWL_RANK  = [IDS.arjun, IDS.kamesh];                        // by wickets desc
