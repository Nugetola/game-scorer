/**
 * Core type definitions for Spot Pool & Face Mode Scorekeeper
 */

export type GameMode = 'SPOT_POOL' | 'FACE_MODE';
export type PlayerStatus = 'ACTIVE' | 'DEACTIVATED';
export type GameStatus = 'IN_PROGRESS' | 'COMPLETED';
export type PenaltyType = 'WRONG_TARGET' | 'SCRATCH';

/**
 * Player entity - represents a player in the system
 */
export interface Player {
  id: string;
  name: string;
  createdAt: number; // timestamp
}

/**
 * Game entity - represents a match session
 */
export interface Game {
  id: string;
  mode: GameMode;
  playerCount: number; // 2 for Face Mode, 3+ for Spot Pool
  startedAt: number; // timestamp
  completedAt?: number; // timestamp when game ended
  winner?: string; // player ID
  status: GameStatus;
}

/**
 * Penalty record for audit trail
 */
export interface PenaltyRecord {
  id: string;
  timestamp: number;
  ballValue: number; // 4-15
  type: PenaltyType;
  reason?: string;
}

/**
 * GameScore - real-time player score in a game session
 */
export interface GameScore {
  id: string;
  gameId: string;
  playerId: string;
  playerName: string;
  currentScore: number;
  pottedBalls: number[]; // array of ball values [4-15]
  status: PlayerStatus;
  maxPotential: number; // calculated dynamically
  penalties?: PenaltyRecord[];
}

/**
 * Spot Pool Rules
 */
export interface SpotPoolRules {
  breakValue: number; // +6 for sinking break ball, -4 for scratch
  minPlayers: number; // 3
  maxPlayers: number; // unlimited
  ballValues: Record<number, number>; // ball number -> face value (4-15 balls)
}

/**
 * Face Mode Rules
 */
export interface FaceModeRules {
  playerCount: 2;
  scoringMethod: 'DIFFERENTIAL'; // P1_potted - P2_potted
}

/**
 * Match History entry - for leaderboard/statistics
 */
export interface MatchHistory {
  id: string;
  gameId: string;
  mode: GameMode;
  playersInvolved: string[]; // player IDs
  winner: string; // player ID
  finalScores: Record<string, number>; // playerId -> final score
  completedAt: number; // timestamp
  duration: number; // milliseconds
}

/**
 * Calculated game state for UI rendering
 */
export interface GameState {
  gameId: string;
  mode: GameMode;
  scores: GameScore[];
  leaderRank: GameScore[]; // sorted by current score
  leaderScore: number; // highest current score
  isEliminating: boolean; // indicate if elimination just occurred
  remainingTablePoints: number; // sum of unscored balls
}

/**
 * ActionLogEntry - one scoring or penalty action taken by one player,
 * used to drive PER-PLAYER undo/history. See utils/gameLogic.ts
 * (replayActionLog) for how this is used.
 */
export interface ActionLogEntry {
  id: string;
  playerIdx: number; // index into the current game's scores[] array
  kind: 'POT' | 'PENALTY';
  ballValue: number;
  penaltyType?: PenaltyType; // only set when kind === 'PENALTY'
  reason?: string; // only set when kind === 'PENALTY'
  penaltyId?: string; // DB id of the penalties row, only set when kind === 'PENALTY'
  timestamp: number;
}