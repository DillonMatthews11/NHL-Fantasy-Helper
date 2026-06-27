import { useMemo, useState } from 'react';
import { useDraft } from '../../contexts/DraftContext';
import type { DraftPick, DraftPlayer } from '../../types/draft';

// Position color mapping for hockey
const POSITION_COLORS: Record<string, { border: string; bg: string; label: string }> = {
  C: { border: '#ff6b35', bg: 'rgba(255, 107, 53, 0.1)', label: 'Center' },
  LW: { border: '#4ecdc4', bg: 'rgba(78, 205, 196, 0.1)', label: 'Left Wing' },
  RW: { border: '#5b7fff', bg: 'rgba(91, 127, 255, 0.1)', label: 'Right Wing' },
  D: { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', label: 'Defense' },
  G: { border: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', label: 'Goalie' },
  F: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', label: 'Forward' },
  UTIL: { border: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', label: 'Utility' },
};

function getPositionColor(positionCode: string): { border: string; bg: string } {
  // Try to match first position (e.g., "C" from "C/LW")
  const primaryPos = positionCode.split('/')[0];

  // Normalize position codes
  const normalizedPos = primaryPos === 'L' ? 'LW' : primaryPos === 'R' ? 'RW' : primaryPos;

  return POSITION_COLORS[normalizedPos] || { border: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' };
}

interface PlayerCardProps {
  pick: DraftPick;
  isUserTeam: boolean;
  onClick?: () => void;
}

function PlayerCard({ pick, isUserTeam, onClick }: PlayerCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!pick.player) {
    // Empty cell
    return (
      <div className={`draft-grid-cell empty ${isUserTeam ? 'user-team-cell' : ''}`}>
        <div className="pick-number-label">
          {pick.round}.{String(pick.pickInRound).padStart(2, '0')}
        </div>
      </div>
    );
  }

  const player = pick.player;
  const colors = getPositionColor(player.positionCode);

  return (
    <div
      className={`draft-grid-cell filled ${isUserTeam ? 'user-team-cell' : ''} ${pick.isUserPick ? 'user-pick-cell' : ''}`}
      style={{
        borderLeftColor: colors.border,
        backgroundColor: colors.bg,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
    >
      <div className="pick-number-label">
        {pick.round}.{String(pick.pickInRound).padStart(2, '0')}
      </div>

      <div className="player-card-name" title={player.skaterFullName}>
        {player.skaterFullName}
      </div>

      <div className="player-card-info">
        <span className="player-team-badge">{player.teamAbbrevs}</span>
        <span className="player-pos-badge" style={{ backgroundColor: colors.border }}>
          {player.positionCode}
        </span>
      </div>

      {/* Tooltip on hover */}
      {showTooltip && (
        <div className="player-card-tooltip">
          <div className="tooltip-name">{player.skaterFullName}</div>
          <div className="tooltip-info">
            <div><strong>Team:</strong> {player.teamAbbrevs}</div>
            <div><strong>Position:</strong> {player.positionCode}</div>
            <div><strong>ADP:</strong> {player.espnADP?.toFixed(1) || 'N/A'}</div>
            {player.positionCode === 'G' && player.wins !== undefined ? (
              <>
                <div><strong>Wins:</strong> {player.wins || 0}</div>
                <div><strong>Save %:</strong> {player.savePct?.toFixed(3) || 'N/A'}</div>
              </>
            ) : (
              player.points !== undefined && (
                <div><strong>Points:</strong> {player.points}</div>
              )
            )}
          </div>
          <div className="tooltip-hint">Click for details</div>
        </div>
      )}
    </div>
  );
}

export default function DraftBoard() {
  const { state } = useDraft();
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPlayer | null>(null);

  // Organize picks into a grid: [round][team]
  const draftGrid = useMemo(() => {
    const grid: DraftPick[][] = [];
    const numTeams = state.leagueSettings?.numTeams || 0;

    if (numTeams === 0) return grid;

    // Get total rounds
    const maxRound = Math.max(...state.draftOrder.map(p => p.round), 0);

    for (let round = 1; round <= maxRound; round++) {
      const roundPicks: DraftPick[] = [];

      for (let team = 0; team < numTeams; team++) {
        const pick = state.draftOrder.find(
          p => p.round === round && p.teamIndex === team
        );

        if (pick) {
          roundPicks.push(pick);
        }
      }

      grid.push(roundPicks);
    }

    return grid;
  }, [state.draftOrder, state.leagueSettings]);

  const handlePlayerClick = (player: DraftPlayer | null) => {
    setSelectedPlayer(player);
  };

  if (!state.leagueSettings) {
    return <div className="draft-board-grid">No draft in progress</div>;
  }

  const numTeams = state.leagueSettings.numTeams;
  const userTeamIndex = state.leagueSettings.userDraftPosition - 1;

  return (
    <div className="draft-board-grid-container">
      {/* Position Legend */}
      <div className="position-legend">
        <div className="legend-title">Position Colors:</div>
        <div className="legend-items">
          {Object.entries(POSITION_COLORS).map(([pos, { border, label }]) => (
            <div key={pos} className="legend-item">
              <div className="legend-color" style={{ backgroundColor: border }} />
              <span className="legend-label">{pos} - {label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Draft Grid */}
      <div className="draft-grid-wrapper">
        <div
          className="draft-grid"
          style={{
            gridTemplateColumns: `80px repeat(${numTeams}, 1fr)`,
            gridTemplateRows: `60px repeat(${draftGrid.length}, 1fr)`,
          }}
        >
          {/* Top-left corner cell */}
          <div className="grid-header corner-header">
            <div className="round-label">Round</div>
          </div>

          {/* Team headers */}
          {state.teams.map((team, idx) => (
            <div
              key={`header-${idx}`}
              className={`grid-header team-header ${idx === userTeamIndex ? 'user-team-header' : ''}`}
            >
              <div className="team-header-name">
                {team.teamName}
                {team.isUser && <span className="you-badge-grid">YOU</span>}
              </div>
              <div className="team-header-picks">{team.picks.length} picks</div>
            </div>
          ))}

          {/* Grid rows */}
          {draftGrid.map((roundPicks, roundIndex) => {
            const roundNum = roundIndex + 1;
            const isEvenRound = roundNum % 2 === 0;

            return (
              <div key={`round-${roundNum}`} className="draft-grid-row" style={{ display: 'contents' }}>
                {/* Round header */}
                <div className={`grid-header round-header ${isEvenRound ? 'even-round' : 'odd-round'}`}>
                  <div className="round-number">Rd {roundNum}</div>
                  {isEvenRound && <div className="snake-indicator">←</div>}
                  {!isEvenRound && <div className="snake-indicator">→</div>}
                </div>

                {/* Pick cells */}
                {roundPicks.map((pick) => (
                  <PlayerCard
                    key={`${pick.round}-${pick.teamIndex}`}
                    pick={pick}
                    isUserTeam={pick.teamIndex === userTeamIndex}
                    onClick={() => handlePlayerClick(pick.player)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <div className="player-modal-overlay" onClick={() => setSelectedPlayer(null)}>
          <div className="player-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedPlayer(null)}>
              ✕
            </button>

            <div className="modal-header">
              <h2>{selectedPlayer.skaterFullName}</h2>
              <div className="modal-subtitle">
                {selectedPlayer.teamAbbrevs} · {selectedPlayer.positionCode}
              </div>
            </div>

            <div className="modal-stats">
              <div className="modal-stat">
                <div className="stat-label">ADP</div>
                <div className="stat-value">{selectedPlayer.espnADP?.toFixed(1) || 'N/A'}</div>
              </div>
              <div className="modal-stat">
                <div className="stat-label">ESPN Rank</div>
                <div className="stat-value">{selectedPlayer.espnTotalRanking || 'N/A'}</div>
              </div>
              <div className="modal-stat">
                <div className="stat-label">Games Played</div>
                <div className="stat-value">{selectedPlayer.gamesPlayed || 0}</div>
              </div>

              {/* Goalie stats */}
              {selectedPlayer.positionCode === 'G' && selectedPlayer.wins !== undefined ? (
                <>
                  <div className="modal-stat">
                    <div className="stat-label">Wins</div>
                    <div className="stat-value">{selectedPlayer.wins || 0}</div>
                  </div>
                  <div className="modal-stat">
                    <div className="stat-label">Save %</div>
                    <div className="stat-value">{selectedPlayer.savePct?.toFixed(3) || 'N/A'}</div>
                  </div>
                  <div className="modal-stat">
                    <div className="stat-label">GAA</div>
                    <div className="stat-value">{selectedPlayer.goalsAgainstAverage?.toFixed(2) || 'N/A'}</div>
                  </div>
                  <div className="modal-stat">
                    <div className="stat-label">Shutouts</div>
                    <div className="stat-value">{selectedPlayer.shutouts || 0}</div>
                  </div>
                </>
              ) : (
                /* Skater stats */
                selectedPlayer.points !== undefined && (
                  <>
                    <div className="modal-stat">
                      <div className="stat-label">Points</div>
                      <div className="stat-value">{selectedPlayer.points}</div>
                    </div>
                    <div className="modal-stat">
                      <div className="stat-label">Goals</div>
                      <div className="stat-value">{selectedPlayer.goals || 0}</div>
                    </div>
                    <div className="modal-stat">
                      <div className="stat-label">Assists</div>
                      <div className="stat-value">{selectedPlayer.assists || 0}</div>
                    </div>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
