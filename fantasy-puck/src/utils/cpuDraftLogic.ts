import type {
  CPUDraftWeights,
  DraftPlayer,
  RosterConfig,
  TeamRoster,
} from '../types/draft';
import {
  getPositionalNeeds,
  hasCriticalPositionalNeeds,
} from './draftEngine';

/**
 * Default CPU draft weights
 */
export const DEFAULT_CPU_WEIGHTS: CPUDraftWeights = {
  adpWeight: 0.5,
  positionalNeedWeight: 0.3,
  valueWeight: 0.15,
  randomnessWeight: 0.05,
};

/**
 * Score a player for CPU drafting based on multiple factors
 */
function scorePlayerForCPU(
  player: DraftPlayer,
  roster: TeamRoster,
  rosterConfig: RosterConfig,
  currentPickNumber: number,
  weights: CPUDraftWeights = DEFAULT_CPU_WEIGHTS
): number {
  let score = 0;

  // 1. ADP Score (lower ADP = higher score)
  // Normalize ADP: if ADP is close to current pick, higher score
  const adpDiff = Math.abs(player.espnADP - currentPickNumber);
  const adpScore = Math.max(0, 100 - adpDiff * 2); // Penalty for picks far from ADP
  score += adpScore * weights.adpWeight;

  // 2. Positional Need Score
  const needs = getPositionalNeeds(roster, rosterConfig);
  let positionalScore = 0;

  // Check if player fills a critical need
  for (const pos of player.positions) {
    if (needs[pos] > 0) {
      // Higher score for positions with more unfilled slots
      positionalScore = Math.max(positionalScore, needs[pos] * 20);
    }
  }

  // Bonus for filling flex positions
  if (needs.F > 0 && player.positions.some(p => ['C', 'LW', 'RW'].includes(p))) {
    positionalScore = Math.max(positionalScore, needs.F * 15);
  }

  // UTIL can always be filled
  if (needs.UTIL > 0) {
    positionalScore = Math.max(positionalScore, needs.UTIL * 5);
  }

  score += positionalScore * weights.positionalNeedWeight;

  // 3. Value Score (reaching for players vs best available)
  // Lower ADP generally means better player
  const valueScore = Math.max(0, 200 - player.espnADP);
  score += valueScore * weights.valueWeight;

  // 4. Randomness (avoid identical drafts)
  const randomScore = Math.random() * 100;
  score += randomScore * weights.randomnessWeight;

  // 5. Position-specific adjustments
  // Deprioritize goalies early unless critical need
  if (player.positions.includes('G')) {
    if (currentPickNumber < 50 && needs.G < rosterConfig.G) {
      // Not critical yet, reduce score
      score *= 0.4;
    }
  }

  // Prioritize high-value positions (C, D) early
  if (currentPickNumber < 30) {
    if (player.positions.includes('C')) {
      score *= 1.1;
    }
    if (player.positions.includes('D')) {
      score *= 1.05;
    }
  }

  return score;
}

/**
 * CPU selects the best player available based on draft logic
 */
export function selectCPUPick(
  availablePlayers: DraftPlayer[],
  roster: TeamRoster,
  rosterConfig: RosterConfig,
  currentPickNumber: number,
  weights: CPUDraftWeights = DEFAULT_CPU_WEIGHTS
): DraftPlayer | null {
  if (availablePlayers.length === 0) {
    return null;
  }

  // Check for critical positional needs
  const { hasNeeds, criticalPositions } = hasCriticalPositionalNeeds(
    roster,
    rosterConfig
  );

  let candidatePlayers = [...availablePlayers];

  // If critical needs exist and draft is >50% complete, filter to needed positions
  const draftCompletion = roster.picks.length /
    (rosterConfig.C + rosterConfig.LW + rosterConfig.RW + rosterConfig.D +
     rosterConfig.G + rosterConfig.F + rosterConfig.UTIL + rosterConfig.BENCH);

  if (hasNeeds && draftCompletion > 0.5) {
    const needBasedPlayers = availablePlayers.filter(player =>
      player.positions.some(pos => criticalPositions.includes(pos))
    );

    // Only filter if we have options
    if (needBasedPlayers.length > 0) {
      candidatePlayers = needBasedPlayers;
    }
  }

  // Score all candidate players
  const scoredPlayers = candidatePlayers.map(player => ({
    player,
    score: scorePlayerForCPU(player, roster, rosterConfig, currentPickNumber, weights),
  }));

  // Sort by score descending
  scoredPlayers.sort((a, b) => b.score - a.score);

  // Return top pick
  return scoredPlayers[0]?.player || null;
}

/**
 * Auto-pick best available player for user (when timer expires)
 */
export function selectAutoPick(
  availablePlayers: DraftPlayer[],
  roster: TeamRoster,
  rosterConfig: RosterConfig
): DraftPlayer | null {
  if (availablePlayers.length === 0) {
    return null;
  }

  // Check for critical needs first
  const { hasNeeds, criticalPositions } = hasCriticalPositionalNeeds(
    roster,
    rosterConfig
  );

  if (hasNeeds) {
    // Filter to players who fill critical needs
    const needPlayers = availablePlayers.filter(player =>
      player.positions.some(pos => criticalPositions.includes(pos))
    );

    if (needPlayers.length > 0) {
      // Pick best ADP among need players
      return needPlayers.reduce((best, player) =>
        player.espnADP < best.espnADP ? player : best
      );
    }
  }

  // Otherwise, pick best available by ADP
  return availablePlayers.reduce((best, player) =>
    player.espnADP < best.espnADP ? player : best
  );
}

/**
 * Get draft recommendations for the user
 * Returns top 5 recommended picks with reasoning
 */
export function getDraftRecommendations(
  availablePlayers: DraftPlayer[],
  roster: TeamRoster,
  rosterConfig: RosterConfig,
  currentPickNumber: number,
  count: number = 5
): Array<{ player: DraftPlayer; reason: string; score: number }> {
  if (availablePlayers.length === 0) {
    return [];
  }

  const needs = getPositionalNeeds(roster, rosterConfig);
  const { criticalPositions } = hasCriticalPositionalNeeds(
    roster,
    rosterConfig
  );

  // Score all players
  const scoredPlayers = availablePlayers.map(player => {
    const score = scorePlayerForCPU(player, roster, rosterConfig, currentPickNumber);

    // Generate reason
    let reason = '';

    // Check if fills critical need
    const fillsCritical = player.positions.some(pos => criticalPositions.includes(pos));
    if (fillsCritical) {
      reason = `Fills critical need: ${criticalPositions.filter(pos =>
        player.positions.includes(pos)
      ).join(', ')}`;
    } else if (player.espnADP <= currentPickNumber + 10) {
      reason = 'Best available (great value)';
    } else if (player.espnADP <= currentPickNumber + 20) {
      reason = 'Good value at this pick';
    } else {
      // Check positional fit
      const filledPositions = player.positions.filter(pos => needs[pos] > 0);
      if (filledPositions.length > 0) {
        reason = `Fills need: ${filledPositions.join(', ')}`;
      } else {
        reason = 'Best available';
      }
    }

    return { player, reason, score };
  });

  // Sort by score and return top N
  scoredPlayers.sort((a, b) => b.score - a.score);
  return scoredPlayers.slice(0, count);
}
