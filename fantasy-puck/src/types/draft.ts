// Position types
export type Position = 'C' | 'LW' | 'RW' | 'D' | 'G' | 'F' | 'UTIL' | 'BENCH';

// Player interface for draft
export interface DraftPlayer {
  playerId: string;
  skaterFullName: string;
  teamAbbrevs: string;
  positionCode: string; // Can be multiple like "C/LW"
  positions: Position[]; // Parsed positions array
  espnADP: number;
  espnPercentOwned: number;
  espnTotalRanking: number;
  fantasyPoints?: number;
  fantasyPointsPerGame?: number;
  // Additional stats for display
  goals?: number;
  assists?: number;
  points?: number;
  gamesPlayed?: number;
}

// Roster configuration
export interface RosterConfig {
  C: number;
  LW: number;
  RW: number;
  D: number;
  G: number;
  F: number; // Forward flex spots
  UTIL: number; // Utility spots
  BENCH: number;
}

// League settings
export interface LeagueSettings {
  numTeams: number;
  draftFormat: 'snake';
  userDraftPosition: number; // 1-based index
  draftTimerSeconds: number; // 0 = unlimited
  rosterConfig: RosterConfig;
}

// Draft pick
export interface DraftPick {
  overallPick: number; // 1-based
  round: number; // 1-based
  pickInRound: number; // 1-based
  teamIndex: number; // 0-based
  player: DraftPlayer | null; // null until picked
  timestamp?: Date;
  isUserPick: boolean;
}

// Team roster
export interface TeamRoster {
  teamIndex: number;
  teamName: string;
  isUser: boolean;
  picks: DraftPlayer[];
  // Roster slots tracking
  filledPositions: {
    C: number;
    LW: number;
    RW: number;
    D: number;
    G: number;
    F: number;
    UTIL: number;
    BENCH: number;
  };
}

// Draft state
export interface DraftState {
  // Setup
  leagueSettings: LeagueSettings | null;

  // Player pool
  allPlayers: DraftPlayer[];
  availablePlayers: DraftPlayer[];

  // Draft progress
  draftOrder: DraftPick[];
  currentPickIndex: number; // 0-based index into draftOrder

  // Team rosters
  teams: TeamRoster[];

  // Timer
  pickTimerRemaining: number; // seconds
  isTimerActive: boolean;

  // UI state
  currentTab: 'available' | 'my-team' | 'draft-board';
  isDraftStarted: boolean;
  isDraftComplete: boolean;
}

// CPU draft weighting factors
export interface CPUDraftWeights {
  adpWeight: number;
  positionalNeedWeight: number;
  valueWeight: number;
  randomnessWeight: number;
}

// Draft action types
export type DraftAction =
  | { type: 'INITIALIZE_LEAGUE'; payload: { leagueSettings: LeagueSettings; players: DraftPlayer[] } }
  | { type: 'START_DRAFT' }
  | { type: 'MAKE_PICK'; payload: { player: DraftPlayer } }
  | { type: 'AUTO_PICK' }
  | { type: 'UPDATE_TIMER'; payload: { seconds: number } }
  | { type: 'START_TIMER' }
  | { type: 'STOP_TIMER' }
  | { type: 'CHANGE_TAB'; payload: { tab: 'available' | 'my-team' | 'draft-board' } }
  | { type: 'RESET_DRAFT' };
