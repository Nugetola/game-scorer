import { create } from 'zustand';
import { Game, GameScore, GameMode, ActionLogEntry } from '../types';
import GameRepository from '../db/repository';
import { SCORABLE_BALLS, BREAK_BALL_ID } from '../constants/rules';
import {
  calculateMaxPotential,
  replayActionLog,
} from '../utils/gameLogic';

export interface GameStore {
  activeGame: Game | null;
  scores: GameScore[];
  isLoading: boolean;
  error: string | null;
  actionLog: ActionLogEntry[];

  // ✅ HAARAA: "Mathematical Winner" haala wal-falmisiisaa keessatti
  // (fkf target ball kitchen keessa hafuu) refree-n "Hold" tuqee, winner
  // alert-icha yeroof ittisuuf. Tarkaanfii haaraa (pot/penalty/undo) hunda
  // booda automatic-ally false ta'a, akka check-ichi haaraan ta'uuf.
  winnerHoldActive: boolean;
  holdWinnerAlert: () => void;

  startNewGame: (mode: GameMode, players: { id: string; name: string }[]) => Promise<boolean>;
  loadActiveGame: () => Promise<void>;
  finishGame: (winnerId: string, finalScores: Record<string, number>) => Promise<void>;
  cancelGame: () => Promise<void>;

  updateScore: (gameScoreId: string, updates: Partial<GameScore>) => Promise<void>;
  recordPottedBall: (playerIdx: number, ballValue: number) => Promise<void>;
  applyPenalty: (playerIdx: number, ballValue: number, type: 'WRONG_TARGET' | 'SCRATCH', reason?: string) => Promise<void>;

  // Per-player undo/history — see utils/gameLogic.ts (replayActionLog) for
  // why this is log-replay based rather than a single global snapshot stack.
  undoLastActionForPlayer: (playerIdx: number) => Promise<void>;
  getPlayerHistory: (playerIdx: number) => ActionLogEntry[];

  getLeaderScore: () => number;
  getGameWinner: () => GameScore | null;
  shouldGameBeComplete: () => boolean;
  getTargetBall: () => number | null;
}

let _repo: GameRepository | null = null;
function getRepo(): GameRepository {
  if (!_repo) {
    _repo = new GameRepository();
  }
  return _repo;
}

function generateLogId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Persist a freshly-recomputed scores[] array to the DB. Used after both
 * live actions and undo, since both paths produce a new scores array via
 * replayActionLog and need the DB to match it.
 */
async function persistScores(repo: GameRepository, scores: GameScore[]): Promise<void> {
  for (const s of scores) {
    await repo.updateGameScore(s.id, {
      currentScore: s.currentScore,
      pottedBalls: s.pottedBalls,
      maxPotential: s.maxPotential,
      status: s.status,
    });
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  activeGame: null,
  scores: [],
  isLoading: false,
  error: null,
  actionLog: [],
  winnerHoldActive: false,

  holdWinnerAlert: () => set({ winnerHoldActive: true }),

  startNewGame: async (mode, players) => {
    set({ isLoading: true, error: null });
    try {
      const repo = getRepo();
      const playerIds = players.map((p) => p.id);
      const game = await repo.createGame(mode, playerIds);

      const scores: GameScore[] = [];
      for (const player of players) {
        const score = await repo.createGameScore(game.id, player.id, player.name);
        const maxPotential = calculateMaxPotential(0, []);
        await repo.updateGameScore(score.id, { maxPotential });
        scores.push({ ...score, maxPotential });
      }

      set({
        activeGame: game,
        scores,
        isLoading: false,
        actionLog: [],
        winnerHoldActive: false,
      });
      return true;
    } catch (error: any) {
      set({ error: error.message || 'Failed to start game', isLoading: false });
      return false;
    }
  },

  loadActiveGame: async () => {
    set({ isLoading: true, error: null });
    try {
      const repo = getRepo();
      const activeGame = await repo.getActiveGame();
      if (activeGame) {
        const scores = await repo.getGameScoresByGame(activeGame.id);
        set({
          activeGame,
          scores,
          isLoading: false,
          actionLog: [], // action log doesn't persist across app reloads
          winnerHoldActive: false,
        });
      } else {
        set({ activeGame: null, scores: [], isLoading: false, actionLog: [], winnerHoldActive: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to load game', isLoading: false });
    }
  },

  updateScore: async (gameScoreId, updates) => {
    try {
      const repo = getRepo();
      await repo.updateGameScore(gameScoreId, updates);
      set((state) => ({
        scores: state.scores.map((s) =>
          s.id === gameScoreId ? { ...s, ...updates } : s
        ),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to update score' });
    }
  },

  // "Must contact" target: the Break ball takes priority over everything
  // (it's the lowest-priority/first ball on the table), then 4, 5, 6...
  getTargetBall: () => {
    const { scores } = get();
    const pottedAnywhere = new Set<number>();
    for (const s of scores) {
      for (const b of s.pottedBalls) pottedAnywhere.add(b);
    }
    if (!pottedAnywhere.has(BREAK_BALL_ID)) return BREAK_BALL_ID;
    for (const ball of SCORABLE_BALLS) {
      if (!pottedAnywhere.has(ball)) return ball;
    }
    return null;
  },

  recordPottedBall: async (playerIdx, ballValue) => {
    const { scores, activeGame, actionLog } = get();
    const score = scores[playerIdx];
    if (!score || !activeGame) return;

    try {
      const repo = getRepo();

      const entry: ActionLogEntry = {
        id: generateLogId(),
        playerIdx,
        kind: 'POT',
        ballValue,
        timestamp: Date.now(),
      };
      const newLog = [...actionLog, entry];

      const baseline = scores.map((s) => ({ id: s.id, playerId: s.playerId, playerName: s.playerName }));
      const newScores = replayActionLog(baseline, activeGame.mode, newLog).map((s) => ({
        ...s,
        gameId: activeGame.id,
      }));

      await persistScores(repo, newScores);

      // Every new action clears the "hold" — a fresh check should run.
      set({ scores: newScores, actionLog: newLog, winnerHoldActive: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to record potted ball' });
    }
  },

  applyPenalty: async (playerIdx, ballValue, type, reason) => {
    const { activeGame, scores, actionLog } = get();
    const score = scores[playerIdx];
    if (!activeGame || !score) return;

    try {
      const repo = getRepo();

      // Keep the DB penalties audit-trail row so foul type + reason survive
      // app restarts; its id is stored on the log entry so undo can remove it.
      const penalty = await repo.addPenalty(
        score.id,
        activeGame.id,
        score.playerId,
        ballValue,
        type,
        reason
      );

      const entry: ActionLogEntry = {
        id: generateLogId(),
        playerIdx,
        kind: 'PENALTY',
        ballValue,
        penaltyType: type,
        reason,
        penaltyId: penalty.id,
        timestamp: penalty.timestamp,
      };
      const newLog = [...actionLog, entry];

      const baseline = scores.map((s) => ({ id: s.id, playerId: s.playerId, playerName: s.playerName }));
      const newScores = replayActionLog(baseline, activeGame.mode, newLog).map((s) => ({
        ...s,
        gameId: activeGame.id,
      }));

      await persistScores(repo, newScores);

      set({ scores: newScores, actionLog: newLog, winnerHoldActive: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to record penalty' });
    }
  },

  getPlayerHistory: (playerIdx) => {
    const { actionLog } = get();
    return actionLog.filter((e) => e.playerIdx === playerIdx);
  },

  undoLastActionForPlayer: async (playerIdx) => {
    const { activeGame, scores, actionLog } = get();
    if (!activeGame) return;

    // Find this player's most recent action in the log, regardless of
    // what any other player has done since.
    let removeAt = -1;
    for (let i = actionLog.length - 1; i >= 0; i--) {
      if (actionLog[i].playerIdx === playerIdx) {
        removeAt = i;
        break;
      }
    }
    if (removeAt === -1) return; // nothing to undo for this player

    const removedEntry = actionLog[removeAt];

    try {
      const repo = getRepo();

      if (removedEntry.kind === 'PENALTY' && removedEntry.penaltyId) {
        await repo.deletePenalty(removedEntry.penaltyId);
      }

      const newLog = [...actionLog.slice(0, removeAt), ...actionLog.slice(removeAt + 1)];

      const baseline = scores.map((s) => ({ id: s.id, playerId: s.playerId, playerName: s.playerName }));
      const newScores = replayActionLog(baseline, activeGame.mode, newLog).map((s) => ({
        ...s,
        gameId: activeGame.id,
      }));

      await persistScores(repo, newScores);

      set({ scores: newScores, actionLog: newLog, winnerHoldActive: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to undo' });
    }
  },

  getLeaderScore: () => {
    const { scores } = get();
    const activeScores = scores.filter((s) => s.status === 'ACTIVE');
    if (activeScores.length === 0) return 0;
    return Math.max(...activeScores.map((s) => s.currentScore));
  },

  getGameWinner: () => {
    const { scores, activeGame } = get();
    if (scores.length === 0 || !activeGame) return null;

    if (activeGame.mode === 'SPOT_POOL') {
      const activePlayers = scores.filter((s) => s.status === 'ACTIVE');
      if (activePlayers.length === 1) return activePlayers[0];
      return null;
    }

    return scores.reduce((prev, current) => (prev.currentScore > current.currentScore ? prev : current));
  },

  shouldGameBeComplete: () => {
    const { scores, activeGame } = get();
    if (!activeGame) return false;

    if (activeGame.mode === 'SPOT_POOL') {
      const activePlayers = scores.filter((s) => s.status === 'ACTIVE').length;
      return activePlayers <= 1 && scores.length > 1;
    }
    return false;
  },

  finishGame: async (winnerId, finalScores) => {
    const { activeGame, scores } = get();
    if (!activeGame) return;

    try {
      const repo = getRepo();
      set({ isLoading: true });
      await repo.completeGame(activeGame.id, winnerId);

      const playerIds = scores.map((s) => s.playerId);
      await repo.saveMatchHistory(
        activeGame.id,
        activeGame.mode,
        winnerId,
        finalScores,
        playerIds,
        activeGame.startedAt
      );

      set({
        activeGame: null,
        scores: [],
        isLoading: false,
        actionLog: [],
        winnerHoldActive: false,
      });
    } catch (error: any) {
      set({ error: error.message || 'Failed to finish game', isLoading: false });
    }
  },

  // "Cancel Game" — abandon the current game entirely, no winner, no
  // match-history row. repo.deleteGame cleans up penalties, game_scores,
  // and the games row itself (in that order, for the foreign keys).
  cancelGame: async () => {
    const { activeGame } = get();
    if (!activeGame) return;

    try {
      set({ isLoading: true, error: null });
      const repo = getRepo();
      await repo.deleteGame(activeGame.id);
      set({
        activeGame: null,
        scores: [],
        isLoading: false,
        actionLog: [],
        winnerHoldActive: false,
      });
    } catch (error: any) {
      set({ error: error.message || 'Failed to cancel game', isLoading: false });
    }
  },
}));