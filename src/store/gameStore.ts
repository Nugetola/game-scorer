/**
 * Zustand Store - Global game state management
 * Handles score calculations, penalties, elimination, and game state updates
 */

import { create } from 'zustand';
import { GameScore, GameMode, PlayerStatus } from '../types';
import { GameRepository } from '../db/repository';
import {
  calculateMaxPotential,
  getPlayersToEliminate,
  addPointsSpotPool,
  applyPenalty as applyPenaltyLogic,
  addPottedBall,
  getLeaderboard,
  shouldGameEnd,
  getGameWinner,
} from '../utils/gameLogic';

export interface GameStore {
  // State
  gameId: string | null;
  gameMode: GameMode | null;
  scores: GameScore[];
  isLoading: boolean;
  error: string | null;
  lastActionTime: number;

  // Actions: Game Setup
  startNewGame: (mode: GameMode, playerIds: string[]) => Promise<void>;
  loadActiveGame: () => Promise<void>;

  // Actions: Scoring
  recordPottedBall: (playerIndex: number, ballValue: number) => Promise<void>;
  applyPenalty: (playerIndex: number, ballValue: number, type: 'WRONG_TARGET' | 'SCRATCH') => Promise<void>;

  // State Getters
  getLeaderboard: () => GameScore[];
  getLeaderScore: () => number;
  getGameWinner: () => GameScore | null;
  shouldGameBeComplete: () => boolean;
  getPlayerByIndex: (index: number) => GameScore | null;

  // Utils
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const repo = new GameRepository();

  return {
    // Initial state
    gameId: null,
    gameMode: null,
    scores: [],
    isLoading: false,
    error: null,
    lastActionTime: 0,

    // ==================== GAME SETUP ====================

    startNewGame: async (mode: GameMode, playerIds: string[]) => {
      set({ isLoading: true, error: null });
      try {
        const game = await repo.createGame(mode, playerIds);

        const initialScores: GameScore[] = [];
        for (const playerId of playerIds) {
          const player = await repo.getPlayerById(playerId);
          if (player) {
            const gameScore = await repo.createGameScore(game.id, playerId, player.name);
            const maxPotential = calculateMaxPotential(0, []);
            await repo.updateGameScore(gameScore.id, { maxPotential });
            initialScores.push({
              ...gameScore,
              maxPotential,
            });
          }
        }

        set({
          gameId: game.id,
          gameMode: mode,
          scores: initialScores,
          isLoading: false,
          lastActionTime: Date.now(),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to start game';
        set({ error: errorMessage, isLoading: false });
        console.error('Error starting game:', err);
      }
    },

    loadActiveGame: async () => {
      set({ isLoading: true, error: null });
      try {
        const game = await repo.getActiveGame();
        if (!game) {
          set({ gameId: null, gameMode: null, scores: [], isLoading: false });
          return;
        }

        const gameScores = await repo.getGameScoresByGame(game.id);
        const scoresWithPenalties = await Promise.all(
          gameScores.map(async (score) => ({
            ...score,
            penalties: await repo.getPenaltiesByGameScore(score.id),
          }))
        );

        set({
          gameId: game.id,
          gameMode: game.mode,
          scores: scoresWithPenalties,
          isLoading: false,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load game';
        set({ error: errorMessage, isLoading: false });
        console.error('Error loading game:', err);
      }
    },

    // ==================== SCORING ====================

    recordPottedBall: async (playerIndex: number, ballValue: number) => {
      set({ isLoading: true, error: null });
      try {
        const { scores, gameId, gameMode } = get();
        if (!gameId || !gameMode) throw new Error('No active game');

        const playerScore = scores[playerIndex];
        if (!playerScore) throw new Error('Invalid player index');

        let newScore = playerScore.currentScore;
        if (gameMode === 'SPOT_POOL') {
          newScore = addPointsSpotPool(playerScore.currentScore, ballValue);
        }

        const newPottedBalls = addPottedBall(playerScore.pottedBalls, ballValue);
        const newMaxPotential = calculateMaxPotential(newScore, newPottedBalls);

        await repo.updateGameScore(playerScore.id, {
          currentScore: newScore,
          pottedBalls: newPottedBalls,
          maxPotential: newMaxPotential,
        });

        const updatedScores = [...scores];
        updatedScores[playerIndex] = {
          ...playerScore,
          currentScore: newScore,
          pottedBalls: newPottedBalls,
          maxPotential: newMaxPotential,
        };

        if (gameMode === 'SPOT_POOL') {
          const toEliminate = getPlayersToEliminate(updatedScores);
          for (const eliminatedScoreId of toEliminate) {
            const idx = updatedScores.findIndex((s) => s.id === eliminatedScoreId);
            if (idx !== -1) {
              await repo.updateGameScore(eliminatedScoreId, {
                status: 'DEACTIVATED' as PlayerStatus,
              });
              updatedScores[idx] = {
                ...updatedScores[idx],
                status: 'DEACTIVATED',
              };
            }
          }
        }

        set({ scores: updatedScores, isLoading: false, lastActionTime: Date.now() });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to record potted ball';
        set({ error: errorMessage, isLoading: false });
        console.error('Error recording potted ball:', err);
      }
    },

    applyPenalty: async (playerIndex: number, ballValue: number, type: 'WRONG_TARGET' | 'SCRATCH') => {
      set({ isLoading: true, error: null });
      try {
        const { scores, gameId, gameMode } = get();
        if (!gameId || !gameMode) throw new Error('No active game');

        const playerScore = scores[playerIndex];
        if (!playerScore) throw new Error('Invalid player index');

        const newScore = applyPenaltyLogic(playerScore.currentScore, ballValue);

        await repo.addPenalty(playerScore.id, gameId, playerScore.playerId, ballValue, type);

        const newMaxPotential = calculateMaxPotential(newScore, playerScore.pottedBalls);

        await repo.updateGameScore(playerScore.id, {
          currentScore: newScore,
          maxPotential: newMaxPotential,
        });

        const updatedScores = [...scores];
        updatedScores[playerIndex] = {
          ...playerScore,
          currentScore: newScore,
          maxPotential: newMaxPotential,
          penalties: [
            ...(playerScore.penalties || []),
            {
              id: `penalty_${Date.now()}`,
              timestamp: Date.now(),
              ballValue,
              type,
            },
          ],
        };

        if (gameMode === 'SPOT_POOL') {
          const toEliminate = getPlayersToEliminate(updatedScores);
          for (const eliminatedScoreId of toEliminate) {
            const idx = updatedScores.findIndex((s) => s.id === eliminatedScoreId);
            if (idx !== -1) {
              await repo.updateGameScore(eliminatedScoreId, {
                status: 'DEACTIVATED' as PlayerStatus,
              });
              updatedScores[idx] = {
                ...updatedScores[idx],
                status: 'DEACTIVATED',
              };
            }
          }
        }

        set({ scores: updatedScores, isLoading: false, lastActionTime: Date.now() });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to apply penalty';
        set({ error: errorMessage, isLoading: false });
        console.error('Error applying penalty:', err);
      }
    },

    // ==================== STATE GETTERS ====================

    getLeaderboard: () => {
      const { scores } = get();
      return getLeaderboard(scores);
    },

    getLeaderScore: () => {
      const { scores } = get();
      const activeScores = scores.filter((s) => s.status === 'ACTIVE');
      if (activeScores.length === 0) return 0;
      return Math.max(...activeScores.map((s) => s.currentScore));
    },

    getGameWinner: () => {
      const { scores, gameMode } = get();
      if (!gameMode) return null;
      return getGameWinner(gameMode, scores);
    },

    shouldGameBeComplete: () => {
      const { scores, gameMode } = get();
      if (!gameMode) return false;
      return shouldGameEnd(gameMode, scores);
    },

    getPlayerByIndex: (index: number) => {
      const { scores } = get();
      return scores[index] || null;
    },

    // ==================== UTILS ====================

    reset: () => {
      set({
        gameId: null,
        gameMode: null,
        scores: [],
        error: null,
        isLoading: false,
        lastActionTime: 0,
      });
    },
  };
});