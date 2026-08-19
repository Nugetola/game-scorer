import { create } from 'zustand';
import { Game, GameScore, GameMode, PenaltyRecord } from '../types';
import GameRepository from '../db/repository';

export interface GameStore {
  activeGame: Game | null;
  scores: GameScore[];
  isLoading: boolean;
  error: string | null;
  
  // Game Lifecycle Methods
  startNewGame: (mode: GameMode, players: { id: string; name: string }[]) => Promise<boolean>;
  loadActiveGame: () => Promise<void>;
  finishGame: (winnerId: string, finalScores: Record<string, number>) => Promise<void>;

  // Score & Penalty Actions
  updateScore: (gameScoreId: string, updates: Partial<GameScore>) => Promise<void>;
  recordPottedBall: (playerIdx: number, ballValue: number) => Promise<void>;
  applyPenalty: (playerIdx: number, ballValue: number, type: 'WRONG_TARGET' | 'SCRATCH', reason?: string) => Promise<void>;
  
  // Helpers
  getLeaderScore: () => number;
  getGameWinner: () => GameScore | null;
  shouldGameBeComplete: () => boolean;
}

const repo = new GameRepository();

export const useGameStore = create<GameStore>((set, get) => ({
  activeGame: null,
  scores: [],
  isLoading: false,
  error: null,

  startNewGame: async (mode, players) => {
    set({ isLoading: true, error: null });
    try {
      const playerIds = players.map((p) => p.id);
      const game = await repo.createGame(mode, playerIds);

      const scores: GameScore[] = [];
      for (const player of players) {
        const score = await repo.createGameScore(game.id, player.id, player.name);
        scores.push(score);
      }

      set({ activeGame: game, scores, isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message || 'Failed to start game', isLoading: false });
      return false;
    }
  },

  loadActiveGame: async () => {
    set({ isLoading: true, error: null });
    try {
      const activeGame = await repo.getActiveGame();
      if (activeGame) {
        const scores = await repo.getGameScoresByGame(activeGame.id);
        set({ activeGame, scores, isLoading: false });
      } else {
        set({ activeGame: null, scores: [], isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to load game', isLoading: false });
    }
  },

  updateScore: async (gameScoreId, updates) => {
    try {
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

  recordPottedBall: async (playerIdx, ballValue) => {
    const { scores } = get();
    const score = scores[playerIdx];
    if (!score) return;

    const newPottedBalls = [...score.pottedBalls, ballValue];
    const newScore = score.currentScore + ballValue;

    await get().updateScore(score.id, {
      currentScore: newScore,
      pottedBalls: newPottedBalls,
    });
  },

  applyPenalty: async (playerIdx, ballValue, type, reason) => {
    const { activeGame, scores } = get();
    const score = scores[playerIdx];
    if (!activeGame || !score) return;

    try {
      const penalty = await repo.addPenalty(
        score.id,
        activeGame.id,
        score.playerId,
        ballValue,
        type,
        reason
      );

      const newScore = score.currentScore - ballValue;
      const updatedPenalties = [...(score.penalties || []), penalty];

      await repo.updateGameScore(score.id, { currentScore: newScore });

      set((state) => ({
        scores: state.scores.map((s, idx) =>
          idx === playerIdx ? { ...s, currentScore: newScore, penalties: updatedPenalties } : s
        ),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to record penalty' });
    }
  },

  getLeaderScore: () => {
    const { scores } = get();
    if (scores.length === 0) return 0;
    return Math.max(...scores.map((s) => s.currentScore));
  },

  getGameWinner: () => {
    const { scores } = get();
    if (scores.length === 0) return null;
    return scores.reduce((prev, current) => (prev.currentScore > current.currentScore ? prev : current));
  },

  shouldGameBeComplete: () => {
    return false;
  },

  finishGame: async (winnerId, finalScores) => {
    const { activeGame, scores } = get();
    if (!activeGame) return;

    try {
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

      set({ activeGame: null, scores: [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to finish game', isLoading: false });
    }
  },
}));