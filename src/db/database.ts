/**
 * SQLite Database Initialization and Schema Setup
 */
import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'game-scorer.db';

type DatabaseInstance = Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>;

export class Database {
  private static instance: DatabaseInstance | null = null;

  /**
   * Initialize the database and create tables if they don't exist
   */
  static async init(): Promise<DatabaseInstance> {
    if (Database.instance) {
      return Database.instance;
    }

    try {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      Database.instance = db;

      // Enable foreign keys
      await db.execAsync('PRAGMA foreign_keys = ON;');

      // Create all required tables
      await Database.createTables(db);

      return db;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Get the initialized database instance
   */
  static getInstance(): DatabaseInstance {
    if (!Database.instance) {
      throw new Error('Database not initialized. Call Database.init() first.');
    }
    return Database.instance;
  }

  /**
   * Create all database tables with proper schema
   */
  private static async createTables(db: DatabaseInstance): Promise<void> {
    const schemaQuery = `
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK(mode IN ('SPOT_POOL', 'FACE_MODE')),
        playerCount INTEGER NOT NULL,
        startedAt INTEGER NOT NULL,
        completedAt INTEGER,
        winner TEXT,
        status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(status IN ('IN_PROGRESS', 'COMPLETED')),
        FOREIGN KEY (winner) REFERENCES players(id)
      );

      CREATE TABLE IF NOT EXISTS game_scores (
        id TEXT PRIMARY KEY,
        gameId TEXT NOT NULL,
        playerId TEXT NOT NULL,
        playerName TEXT NOT NULL,
        currentScore INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DEACTIVATED')),
        maxPotential INTEGER NOT NULL DEFAULT 0,
        pottedBalls TEXT DEFAULT '[]',
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (gameId) REFERENCES games(id),
        FOREIGN KEY (playerId) REFERENCES players(id),
        UNIQUE(gameId, playerId)
      );

      CREATE TABLE IF NOT EXISTS penalties (
        id TEXT PRIMARY KEY,
        gameScoreId TEXT NOT NULL,
        gameId TEXT NOT NULL,
        playerId TEXT NOT NULL,
        ballValue INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('WRONG_TARGET', 'SCRATCH')),
        reason TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (gameScoreId) REFERENCES game_scores(id),
        FOREIGN KEY (gameId) REFERENCES games(id),
        FOREIGN KEY (playerId) REFERENCES players(id)
      );

      CREATE TABLE IF NOT EXISTS match_history (
        id TEXT PRIMARY KEY,
        gameId TEXT NOT NULL UNIQUE,
        mode TEXT NOT NULL,
        winner TEXT NOT NULL,
        finalScores TEXT NOT NULL,
        playersInvolved TEXT NOT NULL,
        completedAt INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        FOREIGN KEY (gameId) REFERENCES games(id),
        FOREIGN KEY (winner) REFERENCES players(id)
      );

      CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
      CREATE INDEX IF NOT EXISTS idx_game_scores_gameId ON game_scores(gameId);
      CREATE INDEX IF NOT EXISTS idx_game_scores_playerId ON game_scores(playerId);
      CREATE INDEX IF NOT EXISTS idx_penalties_gameScoreId ON penalties(gameScoreId);
      CREATE INDEX IF NOT EXISTS idx_match_history_completedAt ON match_history(completedAt DESC);
    `;

    try {
      await db.execAsync(schemaQuery);
    } catch (error) {
      console.error('Failed to create database tables:', error);
      throw error;
    }
  }

  /**
   * Reset the database (for testing/debug purposes)
   */
  static async reset(): Promise<void> {
    const db = Database.getInstance();
    const dropQuery = `
      DROP TABLE IF EXISTS penalties;
      DROP TABLE IF EXISTS match_history;
      DROP TABLE IF EXISTS game_scores;
      DROP TABLE IF EXISTS games;
      DROP TABLE IF EXISTS players;
    `;

    await db.execAsync(dropQuery);
    await Database.createTables(db);
  }

  /**
   * Close the database connection
   */
  static async close(): Promise<void> {
    if (Database.instance) {
      await Database.instance.closeAsync();
      Database.instance = null;
    }
  }
}

export default Database;