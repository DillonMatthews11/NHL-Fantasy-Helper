import { useMemo } from 'react';
import { useDraft } from '../../contexts/DraftContext';
import type { Position } from '../../types/draft';
import { getPositionalNeeds, getRosterCompletion } from '../../utils/draftEngine';

export default function MyTeam() {
  const { state } = useDraft();

  const userTeam = state.teams.find(t => t.isUser);

  // Assign players to slots (simplified - show in draft order)
  const sortedPicks = useMemo(() => {
    if (!userTeam) return [];
    return [...userTeam.picks].sort((a, b) => {
      const pickA = state.draftOrder.find(p => p.player?.playerId === a.playerId);
      const pickB = state.draftOrder.find(p => p.player?.playerId === b.playerId);
      return (pickA?.overallPick || 0) - (pickB?.overallPick || 0);
    });
  }, [userTeam, state.draftOrder]);

  const positionalNeeds = useMemo(() => {
    if (!userTeam || !state.leagueSettings) return null;
    return getPositionalNeeds(userTeam, state.leagueSettings.rosterConfig);
  }, [userTeam, state.leagueSettings]);

  const rosterCompletion = useMemo(() => {
    if (!userTeam || !state.leagueSettings) return 0;
    return getRosterCompletion(userTeam, state.leagueSettings.rosterConfig);
  }, [userTeam, state.leagueSettings]);

  if (!userTeam || !state.leagueSettings) {
    return <div>Loading...</div>;
  }

  const getPositionLabel = (pos: Position): string => {
    const labels: Record<Position, string> = {
      C: 'Center',
      LW: 'Left Wing',
      RW: 'Right Wing',
      D: 'Defense',
      G: 'Goalie',
      F: 'Forward',
      UTIL: 'Utility',
      BENCH: 'Bench',
    };
    return labels[pos];
  };

  return (
    <div className="my-team">
      {/* Team Summary */}
      <div className="team-summary">
        <h2>Your Team</h2>
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-label">Players Drafted</span>
            <span className="stat-value">{userTeam.picks.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Roster Completion</span>
            <span className="stat-value">{rosterCompletion.toFixed(0)}%</span>
          </div>
          <div className="stat">
            <span className="stat-label">Remaining Picks</span>
            <span className="stat-value">
              {state.draftOrder.filter(p => p.isUserPick && !p.player).length}
            </span>
          </div>
        </div>
      </div>

      {/* Positional Needs */}
      {positionalNeeds && (
        <div className="positional-needs">
          <h3>Positional Needs</h3>
          <div className="needs-grid">
            {(Object.keys(positionalNeeds) as Position[]).map(pos => {
              if (pos === 'BENCH') return null;
              const need = positionalNeeds[pos];
              const total = state.leagueSettings!.rosterConfig[pos];

              if (total === 0) return null;

              return (
                <div key={pos} className="need-item">
                  <span className="need-position">{pos}</span>
                  <div className="need-bar">
                    <div
                      className="need-filled"
                      style={{
                        width: `${total > 0 ? ((total - need) / total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="need-count">
                    {total - need}/{total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Roster */}
      <div className="roster-section">
        <h3>Starting Lineup</h3>
        {sortedPicks.length === 0 ? (
          <div className="empty-roster">No players drafted yet</div>
        ) : (
          <table className="roster-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>Team</th>
                <th>ADP</th>
                <th>Pick #</th>
              </tr>
            </thead>
            <tbody>
              {sortedPicks.map(player => {
                const pick = state.draftOrder.find(
                  p => p.player?.playerId === player.playerId
                );
                return (
                  <tr key={player.playerId}>
                    <td className="player-name">{player.skaterFullName}</td>
                    <td>{player.positionCode}</td>
                    <td>{player.teamAbbrevs}</td>
                    <td>{player.espnADP.toFixed(1)}</td>
                    <td>
                      {pick?.overallPick} (Rd {pick?.round})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Empty Roster Slots Visual */}
      <div className="roster-visual">
        <h3>Roster Slots</h3>
        <div className="position-groups">
          {(Object.keys(state.leagueSettings.rosterConfig) as Position[]).map(pos => {
            if (pos === 'BENCH') return null;
            const count = state.leagueSettings!.rosterConfig[pos];
            const filled = userTeam.filledPositions[pos];

            if (count === 0) return null;

            return (
              <div key={pos} className="position-group">
                <div className="position-header">
                  {getPositionLabel(pos)} ({filled}/{count})
                </div>
                <div className="position-slots">
                  {Array.from({ length: count }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`roster-slot ${idx < filled ? 'slot-filled' : 'slot-empty'}`}
                    >
                      {idx < filled ? '✓' : pos}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bench */}
        {state.leagueSettings.rosterConfig.BENCH > 0 && (
          <div className="position-group">
            <div className="position-header">
              Bench ({userTeam.filledPositions.BENCH}/
              {state.leagueSettings.rosterConfig.BENCH})
            </div>
            <div className="position-slots">
              {Array.from({ length: state.leagueSettings.rosterConfig.BENCH }).map((_, idx) => (
                <div
                  key={idx}
                  className={`roster-slot ${
                    idx < userTeam.filledPositions.BENCH ? 'slot-filled' : 'slot-empty'
                  }`}
                >
                  {idx < userTeam.filledPositions.BENCH ? '✓' : 'BE'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
