/**
 * Game Logic Utilities - calculations for scoring, elimination, etc.
 */

import { GameScore, GameMode } from '../types';
import {
  SPOT_POOL_RULES,
  BALL_VALUES,
} from '../constants/rules';

/**
 * Calculate remaining table points (sum of unpotted balls across the game)
 */
export function calculateRemainingTablePoints(allPottedBalls: number[]): number {
  const totalPoints = SPOT_POOL_RULES.totalTablePoints;
  const pottedPoints = allPottedBalls.reduce((sum, ball) => sum + (BALL_VALUES[ball] || 0), 0);
  return Math.max(0, totalPoints - pottedPoints);
}

/**
 * Calculate max potential score for a player
 * MaxPotential = CurrentScore + RemainingTablePoints
 */
export function calculateMaxPotential(
  currentScore: number,
  allPottedBalls: number[]
): number {
  const remainingPoints = calculateRemainingTablePoints(allPottedBalls);
  return currentScore + remainingPoints;
}

/**
 * Determine which players should be eliminated based on active leader score
 * Player is eliminated if: MaxPotential < ActiveLeaderScore
 */
export function getPlayersToEliminate(scores: GameScore[]): string[] {
  const activeScores = scores.filter((s) => s.status === 'ACTIVE');
  if (activeScores.length === 0) return [];

  // Find the highest score among ACTIVE players
  const activeLeaderScore = Math.max(...activeScores.map((s) => s.currentScore));

  // Find active players whose max potential is strictly less than the leader score
  return activeScores
    .filter((score) => score.maxPotential < activeLeaderScore)
    .map((score) => score.id);
}

/**
 * Add points to a player's score (Spot Pool mode)
 */
export function addPointsSpotPool(
  currentScore: number,
  ballValue: number
): number {
  return currentScore + ballValue;
}

/**
 * Add potted ball to player's list
 */
export function addPottedBall(pottedBalls: number[], ballValue: number): number[] {
  return [...pottedBalls, ballValue];
}

/**
 * Apply penalty - deduct ball value from score (both modes)
 */
export function applyPenalty(currentScore: number, ballValue: number): number {
  return Math.max(0, currentScore - ballValue);
}

/**
 * Calculate differential score for Face Mode
 * Score = Player1_Potted - Player2_Potted
 */
export function calculateFaceModeScore(
  player1Potted: number[],
  player2Potted: number[]
): number {
  const p1Sum = player1Potted.reduce((sum, ball) => sum + (BALL_VALUES[ball] || 0), 0);
  const p2Sum = player2Potted.reduce((sum, ball) => sum + (BALL_VALUES[ball] || 0), 0);
  return p1Sum - p2Sum;
}

/**
 * Validate if a ball value is scorable (4-15)
 */
export function isValidBallValue(ballValue: number): boolean {
  return ballValue >= 4 && ballValue <= 15;
}

/**
 * Get all players sorted by status (ACTIVE first) and current score (descending)
 */
export function getLeaderboard(scores: GameScore[]): GameScore[] {
  return [...scores].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'ACTIVE' ? -1 : 1;
    }
    return b.currentScore - a.currentScore;
  });
}

/**
 * Check if game should end (only one active player in Spot Pool)
 */
export function shouldGameEnd(mode: GameMode, scores: GameScore[]): boolean {
  if (mode === 'SPOT_POOL') {
    const activePlayers = scores.filter((s) => s.status === 'ACTIVE').length;
    return activePlayers <= 1 && scores.length > 1;
  }
  return false;
}

/**
 * Get the winner of the game
 */
export function getGameWinner(mode: GameMode, scores: GameScore[]): GameScore | null {
  if (scores.length === 0) return null;

  if (mode === 'SPOT_POOL') {
    const activePlayers = scores.filter((s) => s.status === 'ACTIVE');
    if (activePlayers.length === 1) {
      return activePlayers[0];
    }
  } else if (mode === 'FACE_MODE') {
    return scores.reduce((winner, current) =>
      current.currentScore > winner.currentScore ? current : winner,
      scores[0]
    );
  }
  return null;
}

/**
 * Generate game summary with final statistics
 */
export function generateGameSummary(mode: GameMode, scores: GameScore[]) {
  const leaderboard = getLeaderboard(scores);
  const winner = getGameWinner(mode, scores);

  return {
    winner,
    leaderboard,
    totalParticipants: scores.length,
    activePlayers: scores.filter((s) => s.status === 'ACTIVE').length,
    mode,
  };
}