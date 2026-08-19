/**
 * Player Management Store - for player creation and selection
 */

import { create } from 'zustand';
import { Player } from '../types';
import { GameRepository } from '../db/repository';

export interface PlayerStore {
  players: Player[];
  selectedPlayerIds: string[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadAllPlayers: () => Promise<void>;
  createPlayer: (name: string) => Promise<Player>;
  selectPlayer: (playerId: string) => void;
  deselectPlayer: (playerId: string) => void;
  togglePlayerSelection: (playerId: string) => void;
  clearSelection: () => void;

  // Getters
  getSelectedPlayers: () => Player[];
  getSelectedCount: () => number;
}

export const usePlayerStore = create<PlayerStore>((set, get) => {
  const repo = new GameRepository();

  return {
    // State
    players: [],
    selectedPlayerIds: [],
    isLoading: false,
    error: null,

    // ==================== ACTIONS ====================

    loadAllPlayers: async () => {
      set({ isLoading: true, error: null });
      try {
        const players = await repo.getAllPlayers();
        set({ players, isLoading: false });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load players';
        set({ error: errorMessage, isLoading: false });
        console.error('Error loading players:', err);
      }
    },

    createPlayer: async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error('Player name cannot be empty');
      }

      set({ error: null });
      try {
        // Check if player already exists
        const exists = await repo.playerExists(trimmedName);
        if (exists) {
          throw new Error(`Player "${trimmedName}" already exists`);
        }

        const player = await repo.createPlayer(trimmedName);
        const { players } = get();
        set({ players: [...players, player] });
        return player;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create player';
        set({ error: errorMessage });
        throw err;
      }
    },

    selectPlayer: (playerId: string) => {
      const { selectedPlayerIds } = get();
      if (!selectedPlayerIds.includes(playerId)) {
        set({ selectedPlayerIds: [...selectedPlayerIds, playerId] });
      }
    },

    deselectPlayer: (playerId: string) => {
      const { selectedPlayerIds } = get();
      set({ selectedPlayerIds: selectedPlayerIds.filter((id) => id !== playerId) });
    },

    togglePlayerSelection: (playerId: string) => {
      const { selectedPlayerIds } = get();
      if (selectedPlayerIds.includes(playerId)) {
        set({ selectedPlayerIds: selectedPlayerIds.filter((id) => id !== playerId) });
      } else {
        set({ selectedPlayerIds: [...selectedPlayerIds, playerId] });
      }
    },

    clearSelection: () => {
      set({ selectedPlayerIds: [] });
    },

    // ==================== GETTERS ====================

    getSelectedPlayers: () => {
      const { players, selectedPlayerIds } = get();
      return players.filter((p) => selectedPlayerIds.includes(p.id));
    },

    getSelectedCount: () => {
      const { selectedPlayerIds } = get();
      return selectedPlayerIds.length;
    },
  };
});