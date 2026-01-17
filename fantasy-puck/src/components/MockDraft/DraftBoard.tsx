import { useMemo } from 'react';
import { useDraft } from '../../contexts/DraftContext';

export default function DraftBoard() {
  const { state } = useDraft();

  // Group picks by round for visual organization
  const picksByRound = useMemo(() => {
    const rounds: Record<number, typeof state.draftOrder> = {};

    state.draftOrder.forEach(pick => {
      if (!rounds[pick.round]) {
        rounds[pick.round] = [];
      }
      rounds[pick.round].push(pick);
    });

    return rounds;
  }, [state.draftOrder]);

  const roundNumbers = Object.keys(picksByRound)
    .map(Number)
    .sort((a, b) => a - b);

  // Calculate stats by team
  const teamStats = useMemo(() => {
    return state.teams.map(team => {
      const teamPicks = state.draftOrder.filter(
        p => p.teamIndex === team.teamIndex && p.player
      );

      return {
        ...team,
        pickCount: teamPicks.length,
        avgADP:
          teamPicks.length > 0
            ? teamPicks.reduce((sum, p) => sum + (p.player?.espnADP || 0), 0) /
              teamPicks.length
            : 0,
      };
    });
  }, [state.teams, state.draftOrder]);

  return (
    <div className="draft-board">
      {/* Team Summary */}
      <div className="team-summary-section">
        <h3>Team Overview</h3>
        <table className="team-summary-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Players</th>
              <th>Avg ADP</th>
              <th>Next Pick</th>
            </tr>
          </thead>
          <tbody>
            {teamStats.map(team => {
              const nextPick = state.draftOrder.find(
                p => p.teamIndex === team.teamIndex && !p.player
              );

              return (
                <tr key={team.teamIndex} className={team.isUser ? 'user-team-row' : ''}>
                  <td className="team-name">
                    {team.teamName}
                    {team.isUser && <span className="you-badge">YOU</span>}
                  </td>
                  <td>{team.pickCount}</td>
                  <td>{team.avgADP > 0 ? team.avgADP.toFixed(1) : '-'}</td>
                  <td>{nextPick ? `#${nextPick.overallPick}` : 'Complete'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Draft Picks Table */}
      <div className="draft-picks-section">
        <h3>Draft History</h3>

        <div className="draft-table-container">
          <table className="draft-table">
            <thead>
              <tr>
                <th>Pick</th>
                <th>Round</th>
                <th>Team</th>
                <th>Player</th>
                <th>Pos</th>
                <th>NHL Team</th>
                <th>ADP</th>
              </tr>
            </thead>
            <tbody>
              {state.draftOrder.map(pick => {
                const team = state.teams[pick.teamIndex];

                return (
                  <tr
                    key={pick.overallPick}
                    className={`
                      ${pick.player ? 'pick-made' : 'pick-pending'}
                      ${pick.isUserPick ? 'user-pick' : ''}
                      ${
                        pick.overallPick === state.currentPickIndex + 1
                          ? 'current-pick'
                          : ''
                      }
                    `}
                  >
                    <td className="pick-number">{pick.overallPick}</td>
                    <td>
                      {pick.round}.{pick.pickInRound}
                    </td>
                    <td className="team-name">
                      {team?.teamName}
                      {pick.isUserPick && <span className="you-badge-small">YOU</span>}
                    </td>
                    <td className="player-name">
                      {pick.player ? (
                        pick.player.skaterFullName
                      ) : pick.overallPick === state.currentPickIndex + 1 ? (
                        <span className="on-clock">On the Clock</span>
                      ) : (
                        <span className="not-picked">-</span>
                      )}
                    </td>
                    <td>{pick.player?.positionCode || '-'}</td>
                    <td>{pick.player?.teamAbbrevs || '-'}</td>
                    <td>{pick.player ? pick.player.espnADP.toFixed(1) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Round by Round View */}
      <div className="round-view-section">
        <h3>Round by Round</h3>

        {roundNumbers.map(roundNum => {
          const picks = picksByRound[roundNum];
          const completedPicks = picks.filter(p => p.player).length;

          return (
            <div key={roundNum} className="round-section">
              <div className="round-header">
                <h4>Round {roundNum}</h4>
                <span className="round-progress">
                  {completedPicks}/{picks.length} picks made
                </span>
              </div>

              <div className="round-picks-grid">
                {picks.map(pick => (
                  <div
                    key={pick.overallPick}
                    className={`
                      round-pick-card
                      ${pick.player ? 'picked' : 'unpicked'}
                      ${pick.isUserPick ? 'user-pick-card' : ''}
                    `}
                  >
                    <div className="pick-card-header">
                      <span className="pick-card-number">#{pick.overallPick}</span>
                      <span className="pick-card-team">
                        {state.teams[pick.teamIndex]?.teamName}
                      </span>
                    </div>
                    {pick.player ? (
                      <div className="pick-card-player">
                        <div className="pick-card-player-name">
                          {pick.player.skaterFullName}
                        </div>
                        <div className="pick-card-player-info">
                          {pick.player.positionCode} · {pick.player.teamAbbrevs}
                        </div>
                      </div>
                    ) : (
                      <div className="pick-card-empty">-</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
