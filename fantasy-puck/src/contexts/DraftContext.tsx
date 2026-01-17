import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type {
  DraftState,
  DraftAction,
  DraftPlayer,
} from '../types/draft';
import {
  generateSnakeDraftOrder,
  calculateTotalRounds,
  initializeTeamRosters,
  assignPlayerToRoster,
  parsePositions,
} from '../utils/draftEngine';
import { selectCPUPick, selectAutoPick } from '../utils/cpuDraftLogic';

// Initial state
const initialState: DraftState = {
  leagueSettings: null,
  allPlayers: [],
  availablePlayers: [],
  draftOrder: [],
  currentPickIndex: 0,
  teams: [],
  pickTimerRemaining: 0,
  isTimerActive: false,
  currentTab: 'available',
  isDraftStarted: false,
  isDraftComplete: false,
};

// Draft reducer
function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case 'INITIALIZE_LEAGUE': {
      const { leagueSettings, players } = action.payload;
      const numRounds = calculateTotalRounds(leagueSettings.rosterConfig);
      const draftOrder = generateSnakeDraftOrder(
        leagueSettings.numTeams,
        numRounds,
        leagueSettings.userDraftPosition
      );
      const teams = initializeTeamRosters(
        leagueSettings.numTeams,
        leagueSettings.userDraftPosition
      );

      // Parse positions for all players
      const playersWithPositions = players.map(p => ({
        ...p,
        positions: parsePositions(p.positionCode),
      }));

      return {
        ...state,
        leagueSettings,
        allPlayers: playersWithPositions,
        availablePlayers: playersWithPositions,
        draftOrder,
        teams,
        currentPickIndex: 0,
        isDraftStarted: false,
        isDraftComplete: false,
        currentTab: 'available',
      };
    }

    case 'START_DRAFT': {
      return {
        ...state,
        isDraftStarted: true,
        pickTimerRemaining: state.leagueSettings?.draftTimerSeconds || 0,
        isTimerActive: state.draftOrder[0]?.isUserPick || false,
      };
    }

    case 'MAKE_PICK': {
      const { player } = action.payload;
      const currentPick = state.draftOrder[state.currentPickIndex];

      if (!currentPick || currentPick.player !== null) {
        return state; // Invalid state
      }

      // Update draft order
      const newDraftOrder = [...state.draftOrder];
      newDraftOrder[state.currentPickIndex] = {
        ...currentPick,
        player,
        timestamp: new Date(),
      };

      // Update team roster (properly clone the team object to avoid mutations)
      const newTeams = state.teams.map((team, idx) => {
        if (idx !== currentPick.teamIndex) {
          return team; // Return unchanged teams as-is
        }

        // Deep clone the team being updated
        const updatedTeam = {
          ...team,
          picks: [...team.picks, player],
          filledPositions: { ...team.filledPositions },
        };

        // Assign player to roster position
        assignPlayerToRoster(player, updatedTeam, state.leagueSettings!.rosterConfig);

        return updatedTeam;
      });

      // Remove from available players
      const newAvailablePlayers = state.availablePlayers.filter(
        p => p.playerId !== player.playerId
      );

      // Move to next pick
      const nextPickIndex = state.currentPickIndex + 1;
      const isDraftComplete = nextPickIndex >= state.draftOrder.length;
      const nextPick = state.draftOrder[nextPickIndex];

      return {
        ...state,
        draftOrder: newDraftOrder,
        teams: newTeams,
        availablePlayers: newAvailablePlayers,
        currentPickIndex: nextPickIndex,
        isDraftComplete,
        pickTimerRemaining: state.leagueSettings?.draftTimerSeconds || 0,
        isTimerActive: nextPick?.isUserPick || false,
      };
    }

    case 'AUTO_PICK': {
      const currentPick = state.draftOrder[state.currentPickIndex];
      if (!currentPick || currentPick.player !== null) {
        return state;
      }

      const team = state.teams[currentPick.teamIndex];
      const player = selectAutoPick(
        state.availablePlayers,
        team,
        state.leagueSettings!.rosterConfig
      );

      if (!player) {
        return state; // No players available
      }

      // Reuse MAKE_PICK logic
      return draftReducer(state, { type: 'MAKE_PICK', payload: { player } });
    }

    case 'UPDATE_TIMER': {
      return {
        ...state,
        pickTimerRemaining: action.payload.seconds,
      };
    }

    case 'START_TIMER': {
      return {
        ...state,
        isTimerActive: true,
      };
    }

    case 'STOP_TIMER': {
      return {
        ...state,
        isTimerActive: false,
      };
    }

    case 'CHANGE_TAB': {
      return {
        ...state,
        currentTab: action.payload.tab,
      };
    }

    case 'RESET_DRAFT': {
      return initialState;
    }

    default:
      return state;
  }
}

// Context
interface DraftContextType {
  state: DraftState;
  dispatch: React.Dispatch<DraftAction>;
  makePick: (player: DraftPlayer) => void;
  processCPUPick: () => void;
}

const DraftContext = createContext<DraftContextType | undefined>(undefined);

// Provider
export function DraftProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(draftReducer, initialState);
  const timerRef = useRef<number | null>(null);

  // Timer logic
  useEffect(() => {
    if (state.isTimerActive && state.leagueSettings?.draftTimerSeconds !== 0) {
      // Clear existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Start countdown
      timerRef.current = setInterval(() => {
        dispatch({ type: 'UPDATE_TIMER', payload: { seconds: state.pickTimerRemaining - 1 } });
      }, 1000);

      // Auto-pick when timer expires
      if (state.pickTimerRemaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        dispatch({ type: 'AUTO_PICK' });
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state.isTimerActive, state.pickTimerRemaining, state.leagueSettings]);

  // Auto-process CPU picks
  useEffect(() => {
    if (
      state.isDraftStarted &&
      !state.isDraftComplete &&
      state.currentPickIndex < state.draftOrder.length
    ) {
      const currentPick = state.draftOrder[state.currentPickIndex];

      if (currentPick && !currentPick.isUserPick && currentPick.player === null) {
        // CPU turn - process after short delay
        const cpuTimer = setTimeout(() => {
          processCPUPick();
        }, 1500); // 1.5 second delay for realism

        return () => clearTimeout(cpuTimer);
      }
    }
  }, [state.isDraftStarted, state.currentPickIndex, state.draftOrder]);

  const makePick = (player: DraftPlayer) => {
    dispatch({ type: 'MAKE_PICK', payload: { player } });
  };

  const processCPUPick = () => {
    const currentPick = state.draftOrder[state.currentPickIndex];
    if (!currentPick || currentPick.player !== null) {
      return;
    }

    const team = state.teams[currentPick.teamIndex];
    const player = selectCPUPick(
      state.availablePlayers,
      team,
      state.leagueSettings!.rosterConfig,
      currentPick.overallPick
    );

    if (player) {
      makePick(player);
    }
  };

  return (
    <DraftContext.Provider value={{ state, dispatch, makePick, processCPUPick }}>
      {children}
    </DraftContext.Provider>
  );
}

// Hook to use draft context
export function useDraft() {
  const context = useContext(DraftContext);
  if (!context) {
    throw new Error('useDraft must be used within DraftProvider');
  }
  return context;
}
