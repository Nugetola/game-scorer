import { create } from 'zustand';
import { Player } from '../types';
import GameRepository from '../db/repository';

export interface PlayerStore {
  players: Player[];
  isLoading: boolean;
  error: string | null;
  fetchPlayers: () => Promise<void>;
  addPlayer: (name: string) => Promise<Player | null>;
  updatePlayer: (id: string, name: string) => Promise<boolean>;
}

let _repo: GameRepository | null = null;
function getRepo(): GameRepository {
  if (!_repo) {
    _repo = new GameRepository();
  }
  return _repo;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  players: [],
  isLoading: false,
  error: null,

  fetchPlayers: async () => {
    set({ isLoading: true, error: null });
    try {
      const repo = getRepo();
      const players = await repo.getAllPlayers();
      set({ players, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch players', isLoading: false });
    }
  },

  addPlayer: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const repo = getRepo();
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

  // ✅ HAARAA: taphataa jiru maqaa isaa jijjiiruuf (player name editing).
  updatePlayer: async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      set({ error: 'Player name cannot be empty' });
      return false;
    }

    set({ isLoading: true, error: null });
    try {
      const repo = getRepo();
      const { players } = get();
      const current = players.find((p) => p.id === id);
      if (current && current.name === trimmed) {
        set({ isLoading: false });
        return true; // no-op, name unchanged
      }

      const exists = await repo.playerExists(trimmed);
      if (exists) {
        throw new Error('Player name already exists');
      }

      await repo.updatePlayerName(id, trimmed);
      set((state) => ({
        players: state.players.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
        isLoading: false,
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message || 'Failed to rename player', isLoading: false });
      return false;
    }
  },
}));