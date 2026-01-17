import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LeagueSettings, RosterConfig } from '../../types/draft';
import { useDraft } from '../../contexts/DraftContext';
import { calculateTotalRounds } from '../../utils/draftEngine';

export default function DraftSetup() {
  const navigate = useNavigate();
  const { dispatch } = useDraft();

  // League settings state
  const [numTeams, setNumTeams] = useState(12);
  const [userDraftPosition, setUserDraftPosition] = useState(6);
  const [draftTimerSeconds, setDraftTimerSeconds] = useState(60);

  // Roster configuration state
  const [rosterConfig, setRosterConfig] = useState<RosterConfig>({
    C: 2,
    LW: 2,
    RW: 2,
    D: 4,
    G: 2,
    F: 1,
    UTIL: 1,
    BENCH: 5,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalRounds = calculateTotalRounds(rosterConfig);

  const handleRosterChange = (position: keyof RosterConfig, value: number) => {
    setRosterConfig(prev => ({
      ...prev,
      [position]: Math.max(0, value),
    }));
  };

  const validateSettings = (): string | null => {
    if (numTeams < 2 || numTeams > 16) {
      return 'Number of teams must be between 2 and 16';
    }

    if (userDraftPosition < 1 || userDraftPosition > numTeams) {
      return `Draft position must be between 1 and ${numTeams}`;
    }

    if (totalRounds < 1) {
      return 'Roster must have at least 1 position';
    }

    if (totalRounds > 30) {
      return 'Roster size is too large (max 30 rounds)';
    }

    return null;
  };

  const handleStartDraft = async () => {
    const validationError = validateSettings();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch player data from API
      const response = await fetch('http://localhost:3000/players?season=20242025');
      if (!response.ok) {
        throw new Error('Failed to fetch player data');
      }

      const result = await response.json();
      const players = result.data || result; // Handle both formats

      // Filter to only players with ESPN ADP data
      const draftablePlayers = players.filter(
        (p: any) => p.espnADP && p.espnADP > 0 && p.espnADP <= 300
      );

      if (draftablePlayers.length < totalRounds * numTeams) {
        throw new Error('Not enough players with ADP data for this draft size');
      }

      const leagueSettings: LeagueSettings = {
        numTeams,
        draftFormat: 'snake',
        userDraftPosition,
        draftTimerSeconds,
        rosterConfig,
      };

      // Initialize league in context
      dispatch({
        type: 'INITIALIZE_LEAGUE',
        payload: { leagueSettings, players: draftablePlayers },
      });

      // Navigate to draft room
      navigate('/mock-draft/draft-room');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize draft');
      setIsLoading(false);
    }
  };

  return (
    <div className="draft-setup">
      <div className="draft-setup-header">
        <h1>Mock Draft Setup</h1>
        <p>Configure your league settings and start your mock draft</p>
      </div>

      <div className="setup-sections">
        {/* League Settings */}
        <section className="setup-section">
          <h2>League Settings</h2>

          <div className="form-group">
            <label htmlFor="num-teams">Number of Teams</label>
            <input
              id="num-teams"
              type="number"
              min="2"
              max="16"
              value={numTeams}
              onChange={e => {
                const val = parseInt(e.target.value);
                setNumTeams(val);
                // Adjust user position if needed
                if (userDraftPosition > val) {
                  setUserDraftPosition(val);
                }
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="draft-position">Your Draft Position</label>
            <select
              id="draft-position"
              value={userDraftPosition}
              onChange={e => setUserDraftPosition(parseInt(e.target.value))}
            >
              {Array.from({ length: numTeams }, (_, i) => i + 1).map(pos => (
                <option key={pos} value={pos}>
                  Pick {pos}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="draft-timer">Pick Timer</label>
            <select
              id="draft-timer"
              value={draftTimerSeconds}
              onChange={e => setDraftTimerSeconds(parseInt(e.target.value))}
            >
              <option value={0}>Unlimited</option>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={90}>90 seconds</option>
              <option value={120}>2 minutes</option>
            </select>
          </div>
        </section>

        {/* Roster Configuration */}
        <section className="setup-section">
          <h2>Roster Configuration</h2>

          <div className="roster-grid">
            <div className="form-group">
              <label htmlFor="roster-c">Centers (C)</label>
              <input
                id="roster-c"
                type="number"
                min="0"
                max="10"
                value={rosterConfig.C}
                onChange={e => handleRosterChange('C', parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="roster-lw">Left Wings (LW)</label>
              <input
                id="roster-lw"
                type="number"
                min="0"
                max="10"
                value={rosterConfig.LW}
                onChange={e => handleRosterChange('LW', parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="roster-rw">Right Wings (RW)</label>
              <input
                id="roster-rw"
                type="number"
                min="0"
                max="10"
                value={rosterConfig.RW}
                onChange={e => handleRosterChange('RW', parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="roster-d">Defensemen (D)</label>
              <input
                id="roster-d"
                type="number"
                min="0"
                max="10"
                value={rosterConfig.D}
                onChange={e => handleRosterChange('D', parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="roster-g">Goalies (G)</label>
              <input
                id="roster-g"
                type="number"
                min="0"
                max="5"
                value={rosterConfig.G}
                onChange={e => handleRosterChange('G', parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="roster-f">Forwards (F)</label>
              <input
                id="roster-f"
                type="number"
                min="0"
                max="10"
                value={rosterConfig.F}
                onChange={e => handleRosterChange('F', parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="roster-util">Utility (UTIL)</label>
              <input
                id="roster-util"
                type="number"
                min="0"
                max="10"
                value={rosterConfig.UTIL}
                onChange={e => handleRosterChange('UTIL', parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="roster-bench">Bench</label>
              <input
                id="roster-bench"
                type="number"
                min="0"
                max="20"
                value={rosterConfig.BENCH}
                onChange={e => handleRosterChange('BENCH', parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="roster-summary">
            <strong>Total Roster Size:</strong> {totalRounds} players ({totalRounds} rounds)
          </div>
        </section>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="setup-actions">
        <button onClick={() => navigate('/')} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={handleStartDraft}
          disabled={isLoading}
          className="btn-primary"
        >
          {isLoading ? 'Loading Players...' : 'Start Mock Draft'}
        </button>
      </div>
    </div>
  );
}
