import type {
  DraftPick,
  DraftPlayer,
  Position,
  RosterConfig,
  TeamRoster,
} from '../types/draft';

/**
 * Generate snake draft order
 * Example for 12 teams, 16 rounds:
 * Round 1: 1,2,3,4,5,6,7,8,9,10,11,12
 * Round 2: 12,11,10,9,8,7,6,5,4,3,2,1
 * Round 3: 1,2,3,4,5,6,7,8,9,10,11,12
 * etc.
 */
export function generateSnakeDraftOrder(
  numTeams: number,
  numRounds: number,
  userDraftPosition: number // 1-based
): DraftPick[] {
  const draftOrder: DraftPick[] = [];
  let overallPick = 1;

  for (let round = 1; round <= numRounds; round++) {
    const isEvenRound = round % 2 === 0;

    for (let pickInRound = 1; pickInRound <= numTeams; pickInRound++) {
      // Snake draft: reverse order on even rounds
      const teamIndex = isEvenRound
        ? numTeams - pickInRound // 0-based: 11, 10, 9, ..., 0
        : pickInRound - 1; // 0-based: 0, 1, 2, ..., 11

      draftOrder.push({
        overallPick,
        round,
        pickInRound,
        teamIndex,
        player: null,
        isUserPick: teamIndex === userDraftPosition - 1, // Convert to 0-based
      });

      overallPick++;
    }
  }

  return draftOrder;
}

/**
 * Calculate total number of rounds based on roster config
 */
export function calculateTotalRounds(rosterConfig: RosterConfig): number {
  return (
    rosterConfig.C +
    rosterConfig.LW +
    rosterConfig.RW +
    rosterConfig.D +
    rosterConfig.G +
    rosterConfig.F +
    rosterConfig.UTIL +
    rosterConfig.BENCH
  );
}

/**
 * Initialize empty team rosters
 */
export function initializeTeamRosters(
  numTeams: number,
  userDraftPosition: number // 1-based
): TeamRoster[] {
  const teams: TeamRoster[] = [];

  for (let i = 0; i < numTeams; i++) {
    const isUser = i === userDraftPosition - 1;
    teams.push({
      teamIndex: i,
      teamName: isUser ? 'Your Team' : `Team ${i + 1}`,
      isUser,
      picks: [],
      filledPositions: {
        C: 0,
        LW: 0,
        RW: 0,
        D: 0,
        G: 0,
        F: 0,
        UTIL: 0,
        BENCH: 0,
      },
    });
  }

  return teams;
}

/**
 * Parse player position string to array of Position types
 * "C/LW" -> ['C', 'LW']
 */
export function parsePositions(positionCode: string): Position[] {
  const positions = positionCode.split('/').map(p => p.trim()) as Position[];
  return positions;
}

/**
 * Check if a player can fill a specific roster position
 */
export function canFillPosition(player: DraftPlayer, position: Position): boolean {
  // Handle flex positions
  if (position === 'F') {
    // Forward can be C, LW, or RW
    return player.positions.some(p => ['C', 'LW', 'RW'].includes(p));
  }

  if (position === 'UTIL') {
    // Utility can be any position
    return true;
  }

  // Direct position match
  return player.positions.includes(position);
}

/**
 * Get positions a player can fill based on roster config and current roster state
 */
export function getAvailablePositionsForPlayer(
  player: DraftPlayer,
  filledPositions: TeamRoster['filledPositions'],
  rosterConfig: RosterConfig
): Position[] {
  const available: Position[] = [];

  // Check each roster position type
  const positionTypes: Position[] = ['C', 'LW', 'RW', 'D', 'G', 'F', 'UTIL'];

  for (const pos of positionTypes) {
    if (canFillPosition(player, pos)) {
      const maxForPosition = rosterConfig[pos];
      const currentFilled = filledPositions[pos];

      if (currentFilled < maxForPosition) {
        available.push(pos);
      }
    }
  }

  // Always can go to bench if spots available
  if (filledPositions.BENCH < rosterConfig.BENCH) {
    available.push('BENCH');
  }

  return available;
}

/**
 * Assign player to best available roster position
 * Priority: player's actual positions > flex (F) > utility (UTIL) > bench
 */
export function assignPlayerToRoster(
  player: DraftPlayer,
  roster: TeamRoster,
  rosterConfig: RosterConfig
): Position | null {
  const available = getAvailablePositionsForPlayer(
    player,
    roster.filledPositions,
    rosterConfig
  );

  if (available.length === 0) {
    return null; // Roster full (shouldn't happen in normal draft)
  }

  // STEP 1: Try to fill player's direct/primary positions first (C, LW, RW, D, G)
  // These are the positions the player can actually play
  const primaryPositions: Position[] = ['C', 'LW', 'RW', 'D', 'G'];
  for (const pos of primaryPositions) {
    if (player.positions.includes(pos) && available.includes(pos)) {
      roster.filledPositions[pos]++;
      return pos;
    }
  }

  // STEP 2: Try flex forward (F) if player is a forward
  if (available.includes('F') && player.positions.some(p => ['C', 'LW', 'RW'].includes(p))) {
    roster.filledPositions['F']++;
    return 'F';
  }

  // STEP 3: Try utility (UTIL) - can be any skater
  if (available.includes('UTIL')) {
    roster.filledPositions['UTIL']++;
    return 'UTIL';
  }

  // STEP 4: Finally, put on bench
  if (available.includes('BENCH')) {
    roster.filledPositions['BENCH']++;
    return 'BENCH';
  }

  // Fallback (should never reach here)
  const assignedPos = available[0];
  roster.filledPositions[assignedPos]++;
  return assignedPos;
}

/**
 * Get positional needs for a team (how many more of each position needed)
 */
export function getPositionalNeeds(
  roster: TeamRoster,
  rosterConfig: RosterConfig
): Record<Position, number> {
  return {
    C: Math.max(0, rosterConfig.C - roster.filledPositions.C),
    LW: Math.max(0, rosterConfig.LW - roster.filledPositions.LW),
    RW: Math.max(0, rosterConfig.RW - roster.filledPositions.RW),
    D: Math.max(0, rosterConfig.D - roster.filledPositions.D),
    G: Math.max(0, rosterConfig.G - roster.filledPositions.G),
    F: Math.max(0, rosterConfig.F - roster.filledPositions.F),
    UTIL: Math.max(0, rosterConfig.UTIL - roster.filledPositions.UTIL),
    BENCH: Math.max(0, rosterConfig.BENCH - roster.filledPositions.BENCH),
  };
}

/**
 * Check if roster has critical needs (unfilled starting positions)
 */
export function hasCriticalPositionalNeeds(
  roster: TeamRoster,
  rosterConfig: RosterConfig
): { hasNeeds: boolean; criticalPositions: Position[] } {
  const needs = getPositionalNeeds(roster, rosterConfig);
  const criticalPositions: Position[] = [];

  // Critical positions (not bench, not flex)
  const criticalPosTypes: Position[] = ['C', 'LW', 'RW', 'D', 'G'];

  for (const pos of criticalPosTypes) {
    if (needs[pos] > 0 && rosterConfig[pos] > 0) {
      criticalPositions.push(pos);
    }
  }

  return {
    hasNeeds: criticalPositions.length > 0,
    criticalPositions,
  };
}

/**
 * Calculate roster completion percentage
 */
export function getRosterCompletion(
  roster: TeamRoster,
  rosterConfig: RosterConfig
): number {
  const totalSpots = calculateTotalRounds(rosterConfig);
  const filledSpots = roster.picks.length;
  return totalSpots > 0 ? (filledSpots / totalSpots) * 100 : 0;
}

/**
 * Get current pick info
 */
export function getCurrentPickInfo(
  currentPickIndex: number,
  draftOrder: DraftPick[]
): {
  currentPick: DraftPick | null;
  nextPicks: DraftPick[];
  isUserTurn: boolean;
} {
  const currentPick = draftOrder[currentPickIndex] || null;
  const nextPicks = draftOrder.slice(currentPickIndex + 1, currentPickIndex + 4);

  return {
    currentPick,
    nextPicks,
    isUserTurn: currentPick?.isUserPick || false,
  };
}
