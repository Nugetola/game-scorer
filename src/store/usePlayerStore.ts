import { create } from 'zustand';
import { Player } from '../types';
import GameRepository from '../db/repository';

export interface PlayerStore {
  players: Player[];
  isLoading: boolean;
  error: string | null;
  fetchPlayers: () => Promise<void>;
  addPlayer: (name: string) => Promise<Player | null>;
}

const repo = new GameRepository();

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  players: [],
  isLoading: false,
  error: null,

  fetchPlayers: async () => {
    set({ isLoading: true, error: null });
    try {
      const players = await repo.getAllPlayers();
      set({ players, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch players', isLoading: false });
    }
  },

  addPlayer: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const exists = await repo.playerExists(name);
      if (exists) {
        throw new Error('Player name already exists');
      }
      const player = await repo.createPlayer(name);
      set((state) => ({ players: [...state.players, player], isLoading: false }));
      return player;
    } catch (error: any) {
      set({ error: error.message || 'Failed to add player', isLoading: false });
      return null;
    }
  },
}));