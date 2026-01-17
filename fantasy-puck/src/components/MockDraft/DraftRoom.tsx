import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraft } from '../../contexts/DraftContext';
import { getCurrentPickInfo } from '../../utils/draftEngine';
import AvailablePlayers from './AvailablePlayers';
import MyTeam from './MyTeam';
import DraftBoard from './DraftBoard';

export default function DraftRoom() {
  const navigate = useNavigate();
  const { state, dispatch } = useDraft();

  // Redirect if no league settings
  useEffect(() => {
    if (!state.leagueSettings) {
      navigate('/mock-draft/setup');
    }
  }, [state.leagueSettings, navigate]);

  // Start draft on mount if not already started
  useEffect(() => {
    if (state.leagueSettings && !state.isDraftStarted && !state.isDraftComplete) {
      dispatch({ type: 'START_DRAFT' });
    }
  }, [state.leagueSettings, state.isDraftStarted, state.isDraftComplete, dispatch]);

  if (!state.leagueSettings) {
    return <div>Loading...</div>;
  }

  const { currentPick, nextPicks, isUserTurn } = getCurrentPickInfo(
    state.currentPickIndex,
    state.draftOrder
  );

  const userTeam = state.teams.find(t => t.isUser);

  const handleTabChange = (tab: 'available' | 'my-team' | 'draft-board') => {
    dispatch({ type: 'CHANGE_TAB', payload: { tab } });
  };

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="draft-room">
      {/* Header */}
      <div className="draft-room-header">
        <div className="draft-info">
          <h1>Mock Draft</h1>
          <div className="league-info">
            {state.leagueSettings.numTeams} Teams · Snake Draft · Pick {state.leagueSettings.userDraftPosition}
          </div>
        </div>

        {state.isDraftComplete ? (
          <div className="draft-complete-banner">
            <h2>Draft Complete!</h2>
            <button onClick={() => navigate('/mock-draft/setup')} className="btn-primary">
              New Mock Draft
            </button>
          </div>
        ) : (
          <div className="pick-info">
            {currentPick && (
              <>
                <div className="current-pick">
                  <div className="pick-label">
                    {isUserTurn ? 'YOUR PICK' : 'ON THE CLOCK'}
                  </div>
                  <div className="pick-details">
                    <span className="pick-number">Pick {currentPick.overallPick}</span>
                    <span className="round-info">
                      Round {currentPick.round}, Pick {currentPick.pickInRound}
                    </span>
                    <span className="team-name">
                      {state.teams[currentPick.teamIndex]?.teamName}
                    </span>
                  </div>
                </div>

                {isUserTurn && state.leagueSettings.draftTimerSeconds > 0 && (
                  <div className="timer">
                    <div className="timer-label">Time Remaining</div>
                    <div className={`timer-value ${state.pickTimerRemaining <= 10 ? 'timer-warning' : ''}`}>
                      {formatTime(state.pickTimerRemaining)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Upcoming Picks */}
      {!state.isDraftComplete && nextPicks.length > 0 && (
        <div className="upcoming-picks">
          <span className="upcoming-label">Upcoming:</span>
          {nextPicks.map(pick => (
            <span key={pick.overallPick} className="upcoming-pick">
              {pick.overallPick}. {state.teams[pick.teamIndex]?.teamName}
              {pick.isUserPick && ' (YOU)'}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="draft-tabs">
        <button
          className={`tab ${state.currentTab === 'available' ? 'tab-active' : ''}`}
          onClick={() => handleTabChange('available')}
        >
          Available Players
          <span className="tab-badge">{state.availablePlayers.length}</span>
        </button>
        <button
          className={`tab ${state.currentTab === 'my-team' ? 'tab-active' : ''}`}
          onClick={() => handleTabChange('my-team')}
        >
          My Team
          <span className="tab-badge">{userTeam?.picks.length || 0}</span>
        </button>
        <button
          className={`tab ${state.currentTab === 'draft-board' ? 'tab-active' : ''}`}
          onClick={() => handleTabChange('draft-board')}
        >
          Draft Board
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {state.currentTab === 'available' && <AvailablePlayers />}
        {state.currentTab === 'my-team' && <MyTeam />}
        {state.currentTab === 'draft-board' && <DraftBoard />}
      </div>
    </div>
  );
}
