/**
 * Game Logic Utilities - calculations for scoring, elimination, etc.
 */

import { GameScore, GameMode, ActionLogEntry } from '../types';
import {
  SPOT_POOL_RULES,
  BALL_VALUES,
} from '../constants/rules';

/**
 * Look up the actual point value for a tapped ball id. For balls 4-15 this
 * is just the ball's own number (BALL_VALUES[n] === n), but the Break ball
 * (id 3) is worth 6, not 3 — so scoring must always go through this lookup
 * rather than using the tapped ball id directly as the point value.
 */
export function pointValueForBall(ballId: number): number {
  return BALL_VALUES[ballId] ?? ballId;
}

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
 * ✅ SIRREEFFAMA: taphattoota ACTIVE/DEACTIVATED gidduu **lamaan
 * karaatti** (both directions) herregama — kanaan dura taphataan tokko
 * DEACTIVATED erga ta'ee booda deebi'ee ACTIVE ta'uu hin dandeenye ture
 * (fkf leader-ichi erga adabamee score isaa hir'atee booda).
 *
 * Marsaa/tarkaanfii hunda booda, taphattoota HUNDA (ACTIVE, DEACTIVATED
 * ta'anis dabalatee) irra deebi'amee ilaalama: `maxPotential >= leaderScore`
 * yoo ta'e ACTIVE, yoo hin taane DEACTIVATED — leader-ichi mataan isaa
 * yeroo hunda ACTIVE ta'a (maxPotential isaa >= isa mataa isaa waan ta'eef).
 */
export function recomputeAllStatuses(scores: GameScore[]): GameScore[] {
  if (scores.length === 0) return scores;
  const leaderScore = Math.max(...scores.map((s) => s.currentScore));
  return scores.map((s) => ({
    ...s,
    status: s.maxPotential >= leaderScore ? 'ACTIVE' : 'DEACTIVATED',
  }));
}

/**
 * @deprecated one-directional elimination check, kept for reference/back-
 * compat only. replayActionLog now uses recomputeAllStatuses instead,
 * since that also handles reactivation.
 */
export function getPlayersToEliminate(scores: GameScore[]): string[] {
  const activeScores = scores.filter((s) => s.status === 'ACTIVE');
  if (activeScores.length === 0) return [];
  const activeLeaderScore = Math.max(...activeScores.map((s) => s.currentScore));
  return activeScores
    .filter((score) => score.maxPotential < activeLeaderScore)
    .map((score) => score.id);
}

/**
 * Add points to a player's score (Spot Pool mode)
 */
export function addPointsSpotPool(
  currentScore: number,
  pointsToAdd: number
): number {
  return currentScore + pointsToAdd;
}

/**
 * Add potted ball to player's list
 */
export function addPottedBall(pottedBalls: number[], ballValue: number): number[] {
  return [...pottedBalls, ballValue];
}

/**
 * Apply penalty - deduct ball value from score (both modes).
 * ✅ SIRREEFFAMA: score-ii 0 gadi (negative) ta'uu ni danda'a — kanaan
 * dura Math.max(0, ...) score gara 0tti dhaabaa ture, ammaan tana hin
 * dhaabu. Fakkeenya: 0 - 4 = -4, 12 - 15 = -3.
 */
export function applyPenalty(currentScore: number, ballValue: number): number {
  return currentScore - ballValue;
}

/**
 * Face Mode net-change: score is a single running differential
 * (Player1_potted_total - Player2_potted_total), represented as
 * [p1Display, p2Display] where one side is always 0.
 * Shared by useGameStore (live play) and replayActionLog (undo/history)
 * so both compute identically.
 */
export function applyFaceModeNetChange(
  p1Score: number,
  p2Score: number,
  change: number
): [number, number] {
  const netBefore = p1Score - p2Score;
  const netAfter = netBefore + change;
  return [Math.max(netAfter, 0), Math.max(-netAfter, 0)];
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
 * Validate if a ball value is scorable (Break ball, or 4-15)
 */
export function isValidBallValue(ballValue: number): boolean {
  return ballValue in BALL_VALUES;
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

/**
 * ============================================================
 * PER-PLAYER UNDO/HISTORY SUPPORT
 * ============================================================
 *
 * Instead of one global undo stack (which forces you to undo
 * everyone's most recent action before you can undo an older
 * one), every scoring/penalty action is appended to a single
 * flat `actionLog`, tagged with which player made it.
 *
 * To undo ONE specific player's last action without disturbing
 * anything any other player did afterward, we don't try to
 * "reverse" that one action in place — we remove it from the
 * log and REPLAY the entire remaining log from a clean baseline.
 * This guarantees the resulting scores are always exactly what
 * they'd have been if that action had simply never happened,
 * no matter how actions from different players are interleaved.
 */

interface BaselinePlayer {
  id: string; // game_scores row id
  playerId: string;
  playerName: string;
}

export function replayActionLog(
  players: BaselinePlayer[],
  mode: GameMode,
  log: ActionLogEntry[]
): GameScore[] {
  let scores: GameScore[] = players.map((p) => ({
    id: p.id,
    gameId: '',
    playerId: p.playerId,
    playerName: p.playerName,
    currentScore: 0,
    pottedBalls: [],
    status: 'ACTIVE',
    maxPotential: calculateMaxPotential(0, []),
    penalties: [],
  }));

  for (const entry of log) {
    const idx = entry.playerIdx;
    const score = scores[idx];
    if (!score) continue;

    if (entry.kind === 'POT') {
      if (mode === 'FACE_MODE') {
        const p1 = scores[0];
        const p2 = scores[1];
        if (!p1 || !p2) continue;
        const value = pointValueForBall(entry.ballValue);
        const change = idx === 0 ? value : -value;
        const [p1New, p2New] = applyFaceModeNetChange(p1.currentScore, p2.currentScore, change);
        const newPotted = addPottedBall(score.pottedBalls, entry.ballValue);
        scores = scores.map((s, i) => {
          let next = s;
          if (i === 0) next = { ...next, currentScore: p1New };
          if (i === 1) next = { ...next, currentScore: p2New };
          if (i === idx) next = { ...next, pottedBalls: newPotted };
          return next;
        });
      } else {
        const value = pointValueForBall(entry.ballValue);
        const newScore = addPointsSpotPool(score.currentScore, value);
        const newPotted = addPottedBall(score.pottedBalls, entry.ballValue);
        scores = scores.map((s, i) =>
          i === idx ? { ...s, currentScore: newScore, pottedBalls: newPotted } : s
        );

        // maxPotential for EVERY player uses the GLOBAL set of potted
        // balls (one shared table), then statuses are recomputed
        // symmetrically (see recomputeAllStatuses above).
        const globalPottedBalls: number[] = [];
        scores.forEach((s) => globalPottedBalls.push(...s.pottedBalls));
        scores = scores.map((s) => ({
          ...s,
          maxPotential: calculateMaxPotential(s.currentScore, globalPottedBalls),
        }));

        scores = recomputeAllStatuses(scores);
      }
    } else {
      // PENALTY (Break ball never appears here — Penalty grid is 4-15 only)
      if (mode === 'FACE_MODE') {
        const p1 = scores[0];
        const p2 = scores[1];
        if (!p1 || !p2) continue;
        const change = idx === 0 ? -entry.ballValue : entry.ballValue;
        const [p1New, p2New] = applyFaceModeNetChange(p1.currentScore, p2.currentScore, change);
        scores = scores.map((s, i) => {
          let next = s;
          if (i === 0) next = { ...next, currentScore: p1New };
          if (i === 1) next = { ...next, currentScore: p2New };
          return next;
        });
      } else {
        const newScore = applyPenalty(score.currentScore, entry.ballValue);
        scores = scores.map((s, i) => (i === idx ? { ...s, currentScore: newScore } : s));

        const globalPottedBalls: number[] = [];
        scores.forEach((s) => globalPottedBalls.push(...s.pottedBalls));
        scores = scores.map((s) => ({
          ...s,
          maxPotential: calculateMaxPotential(s.currentScore, globalPottedBalls),
        }));

        scores = recomputeAllStatuses(scores);
      }

      // Rebuild the visible penalty audit trail for this player
      scores = scores.map((s, i) =>
        i === idx
          ? {
              ...s,
              penalties: [
                ...(s.penalties || []),
                {
                  id: entry.penaltyId || entry.id,
                  timestamp: entry.timestamp,
                  ballValue: entry.ballValue,
                  type: entry.penaltyType || 'WRONG_TARGET',
                  reason: entry.reason,
                },
              ],
            }
          : s
      );
    }
  }

  return scores;
}