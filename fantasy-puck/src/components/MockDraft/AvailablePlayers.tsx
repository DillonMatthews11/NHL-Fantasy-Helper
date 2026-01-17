import { useState, useMemo } from 'react';
import type { DraftPlayer, Position } from '../../types/draft';
import { useDraft } from '../../contexts/DraftContext';
import { getCurrentPickInfo } from '../../utils/draftEngine';
import { getDraftRecommendations } from '../../utils/cpuDraftLogic';

type SortField = 'name' | 'position' | 'team' | 'adp';
type SortDirection = 'asc' | 'desc';

export default function AvailablePlayers() {
  const { state, makePick } = useDraft();
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<Position | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<SortField>('adp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showRecommendations, setShowRecommendations] = useState(true);

  const { isUserTurn, currentPick } = getCurrentPickInfo(
    state.currentPickIndex,
    state.draftOrder
  );

  const userTeam = state.teams.find(t => t.isUser);

  // Get recommendations
  const recommendations = useMemo(() => {
    if (!userTeam || !state.leagueSettings || !currentPick) return [];
    return getDraftRecommendations(
      state.availablePlayers,
      userTeam,
      state.leagueSettings.rosterConfig,
      currentPick.overallPick,
      5
    );
  }, [state.availablePlayers, userTeam, state.leagueSettings, currentPick]);

  // Filter and sort players
  const filteredPlayers = useMemo(() => {
    let players = [...state.availablePlayers];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      players = players.filter(
        p =>
          p.skaterFullName.toLowerCase().includes(query) ||
          p.teamAbbrevs.toLowerCase().includes(query)
      );
    }

    // Position filter
    if (positionFilter !== 'ALL') {
      players = players.filter(p => p.positions.includes(positionFilter));
    }

    // Sort
    players.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.skaterFullName.localeCompare(b.skaterFullName);
          break;
        case 'position':
          comparison = a.positionCode.localeCompare(b.positionCode);
          break;
        case 'team':
          comparison = a.teamAbbrevs.localeCompare(b.teamAbbrevs);
          break;
        case 'adp':
          comparison = a.espnADP - b.espnADP;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return players;
  }, [state.availablePlayers, searchQuery, positionFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDraftPlayer = (player: DraftPlayer) => {
    if (!isUserTurn || state.isDraftComplete) return;
    makePick(player);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '⇅';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="available-players">
      {/* Filters */}
      <div className="player-filters">
        <input
          type="text"
          placeholder="Search players..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="search-input"
        />

        <select
          value={positionFilter}
          onChange={e => setPositionFilter(e.target.value as Position | 'ALL')}
          className="position-filter"
        >
          <option value="ALL">All Positions</option>
          <option value="C">C</option>
          <option value="LW">LW</option>
          <option value="RW">RW</option>
          <option value="D">D</option>
          <option value="G">G</option>
        </select>

        {isUserTurn && (
          <button
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="btn-secondary btn-small"
          >
            {showRecommendations ? 'Hide' : 'Show'} Recommendations
          </button>
        )}
      </div>

      {/* Recommendations */}
      {isUserTurn && showRecommendations && recommendations.length > 0 && (
        <div className="recommendations">
          <h3>Recommended Picks</h3>
          <div className="recommendation-list">
            {recommendations.map(({ player, reason }, idx) => (
              <div
                key={player.playerId}
                className="recommendation-item"
                onClick={() => handleDraftPlayer(player)}
              >
                <div className="rec-rank">#{idx + 1}</div>
                <div className="rec-player">
                  <div className="rec-name">{player.skaterFullName}</div>
                  <div className="rec-details">
                    {player.positionCode} · {player.teamAbbrevs} · ADP {player.espnADP.toFixed(1)}
                  </div>
                  <div className="rec-reason">{reason}</div>
                </div>
                <button className="btn-draft-small">Draft</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player Table */}
      <div className="players-table-container">
        <table className="players-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className="sortable">
                Player {getSortIcon('name')}
              </th>
              <th onClick={() => handleSort('position')} className="sortable">
                Pos {getSortIcon('position')}
              </th>
              <th onClick={() => handleSort('team')} className="sortable">
                Team {getSortIcon('team')}
              </th>
              <th onClick={() => handleSort('adp')} className="sortable">
                ADP {getSortIcon('adp')}
              </th>
              <th>Rank</th>
              <th>Own %</th>
              {isUserTurn && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.length === 0 ? (
              <tr>
                <td colSpan={isUserTurn ? 7 : 6} className="no-results">
                  No players found
                </td>
              </tr>
            ) : (
              filteredPlayers.map(player => (
                <tr
                  key={player.playerId}
                  className={isUserTurn ? 'player-row-clickable' : ''}
                  onClick={() => isUserTurn && handleDraftPlayer(player)}
                >
                  <td className="player-name">{player.skaterFullName}</td>
                  <td>{player.positionCode}</td>
                  <td>{player.teamAbbrevs}</td>
                  <td>{player.espnADP.toFixed(1)}</td>
                  <td>{player.espnTotalRanking || '-'}</td>
                  <td>{player.espnPercentOwned?.toFixed(1) || '-'}%</td>
                  {isUserTurn && (
                    <td>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDraftPlayer(player);
                        }}
                        className="btn-draft"
                        disabled={state.isDraftComplete}
                      >
                        Draft
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="players-count">
        Showing {filteredPlayers.length} of {state.availablePlayers.length} players
      </div>
    </div>
  );
}
