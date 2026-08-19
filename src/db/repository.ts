/**
 * Database Repository - CRUD operations for all entities
 */
import * as SQLite from 'expo-sqlite';
import Database from './database';
import {
  Player,
  Game,
  GameScore,
  PenaltyRecord,
  MatchHistory,
  GameMode,
} from '../types';

type DatabaseInstance = Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>;

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

export class GameRepository {
  private db: DatabaseInstance;

  constructor() {
    this.db = Database.getInstance();
  }

  // ==================== PLAYERS ====================

  async createPlayer(name: string): Promise<Player> {
    const id = generateId();
    const createdAt = Date.now();

    await this.db.runAsync(
      'INSERT INTO players (id, name, createdAt) VALUES (?, ?, ?)',
      [id, name, createdAt]
    );

    return { id, name, createdAt };
  }

  async getPlayerById(id: string): Promise<Player | null> {
    const result = await this.db.getFirstAsync<Player>(
      'SELECT * FROM players WHERE id = ?',
      [id]
    );
    return result || null;
  }

  async getAllPlayers(): Promise<Player[]> {
    const results = await this.db.getAllAsync<Player>(
      'SELECT * FROM players ORDER BY name'
    );
    return results || [];
  }

  async playerExists(name: string): Promise<boolean> {
    const result = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM players WHERE name = ?',
      [name]
    );
    return (result?.count ?? 0) > 0;
  }

  // ==================== GAMES ====================

  async createGame(mode: GameMode, playerIds: string[]): Promise<Game> {
    const id = generateId();
    const startedAt = Date.now();

    await this.db.runAsync(
      'INSERT INTO games (id, mode, playerCount, startedAt, status) VALUES (?, ?, ?, ?, ?)',
      [id, mode, playerIds.length, startedAt, 'IN_PROGRESS']
    );

    return {
      id,
      mode,
      playerCount: playerIds.length,
      startedAt,
      status: 'IN_PROGRESS',
    };
  }

  async getGameById(id: string): Promise<Game | null> {
    const result = await this.db.getFirstAsync<Game>(
      'SELECT * FROM games WHERE id = ?',
      [id]
    );
    return result || null;
  }

  async completeGame(gameId: string, winnerId: string): Promise<void> {
    const completedAt = Date.now();
    await this.db.runAsync(
      'UPDATE games SET status = ?, completedAt = ?, winner = ? WHERE id = ?',
      ['COMPLETED', completedAt, winnerId, gameId]
    );
  }

  async getActiveGame(): Promise<Game | null> {
    const result = await this.db.getFirstAsync<Game>(
      "SELECT * FROM games WHERE status = 'IN_PROGRESS' ORDER BY startedAt DESC LIMIT 1"
    );
    return result || null;
  }

  // ==================== GAME SCORES ====================

  async createGameScore(
    gameId: string,
    playerId: string,
    playerName: string
  ): Promise<GameScore> {
    const id = generateId();
    const createdAt = Date.now();

    await this.db.runAsync(
      `INSERT INTO game_scores (id, gameId, playerId, playerName, currentScore, status, maxPotential, pottedBalls, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, gameId, playerId, playerName, 0, 'ACTIVE', 0, '[]', createdAt]
    );

    return {
      id,
      gameId,
      playerId,
      playerName,
      currentScore: 0,
      pottedBalls: [],
      status: 'ACTIVE',
      maxPotential: 0,
      penalties: [],
    };
  }

  async getGameScoresByGame(gameId: string): Promise<GameScore[]> {
    const results = await this.db.getAllAsync<any>(
      'SELECT * FROM game_scores WHERE gameId = ? ORDER BY currentScore DESC',
      [gameId]
    );

    const scores: GameScore[] = [];

    for (const row of results || []) {
      const penalties = await this.getPenaltiesByGameScore(row.id);
      scores.push({
        ...row,
        pottedBalls: JSON.parse(row.pottedBalls || '[]'),
        penalties,
      });
    }

    return scores;
  }

  async updateGameScore(
    gameScoreId: string,
    updates: Partial<GameScore>
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.currentScore !== undefined) {
      fields.push('currentScore = ?');
      values.push(updates.currentScore);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.maxPotential !== undefined) {
      fields.push('maxPotential = ?');
      values.push(updates.maxPotential);
    }
    if (updates.pottedBalls !== undefined) {
      fields.push('pottedBalls = ?');
      values.push(JSON.stringify(updates.pottedBalls));
    }

    if (fields.length === 0) return;

    values.push(gameScoreId);
    await this.db.runAsync(
      `UPDATE game_scores SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  // ==================== PENALTIES ====================

  async addPenalty(
    gameScoreId: string,
    gameId: string,
    playerId: string,
    ballValue: number,
    type: 'WRONG_TARGET' | 'SCRATCH',
    reason?: string
  ): Promise<PenaltyRecord> {
    const id = generateId();
    const timestamp = Date.now();

    await this.db.runAsync(
      `INSERT INTO penalties (id, gameScoreId, gameId, playerId, ballValue, type, reason, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, gameScoreId, gameId, playerId, ballValue, type, reason || null, timestamp]
    );

    return { id, timestamp, ballValue, type, reason };
  }

  async getPenaltiesByGameScore(gameScoreId: string): Promise<PenaltyRecord[]> {
    const results = await this.db.getAllAsync<PenaltyRecord>(
      'SELECT id, timestamp, ballValue, type, reason FROM penalties WHERE gameScoreId = ? ORDER BY timestamp',
      [gameScoreId]
    );
    return results || [];
  }

  // ==================== MATCH HISTORY ====================

  async saveMatchHistory(
    gameId: string,
    mode: GameMode,
    winnerId: string,
    finalScores: Record<string, number>,
    playerIds: string[],
    startedAt: number
  ): Promise<MatchHistory> {
    const id = generateId();
    const completedAt = Date.now();
    const duration = completedAt - startedAt;

    await this.db.runAsync(
      `INSERT INTO match_history (id, gameId, mode, winner, finalScores, playersInvolved, completedAt, duration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        gameId,
        mode,
        winnerId,
        JSON.stringify(finalScores),
        JSON.stringify(playerIds),
        completedAt,
        duration,
      ]
    );

    return {
      id,
      gameId,
      mode,
      winner: winnerId,
      finalScores,
      playersInvolved: playerIds,
      completedAt,
      duration,
    };
  }

  async getMatchHistory(limit: number = 50): Promise<MatchHistory[]> {
    const results = await this.db.getAllAsync<any>(
      'SELECT * FROM match_history ORDER BY completedAt DESC LIMIT ?',
      [limit]
    );

    return (results || []).map((row: any) => ({
      ...row,
      finalScores: JSON.parse(row.finalScores),
      playersInvolved: JSON.parse(row.playersInvolved),
    }));
  }

  async getPlayerStats(playerId: string): Promise<any> {
    const results = await this.db.getAllAsync<any>(
      `SELECT winner FROM match_history, json_each(playersInvolved)
       WHERE json_each.value = ? OR winner = ?`,
      [playerId, playerId]
    );

    const gamesPlayed = results ? results.length : 0;
    const wins = (results || []).filter((match: any) => match.winner === playerId).length;

    return {
      playerId,
      gamesPlayed,
      wins,
      winRate: gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0,
    };
  }
}

export default GameRepository;