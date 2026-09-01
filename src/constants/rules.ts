/**
 * Game Rules and Constants
 */

/**
 * ✅ HAARAA: "Break" ball — kubbaa addaa, kubbaa numbered (4-15) waliin ala,
 * marsaa (table) irratti tokkicha jira. Yoo galche +6 kenna. "Must contact"
 * sarara keessatti kubbaa jalqabaa (dursaa) ta'ee ilaalama, garuu Penalty
 * grid keessa hin argamu. Once potted, deactivates just like any other ball
 * (order doesn't matter — see BallGrid.tsx).
 */
export const BREAK_BALL_ID = 3;

/**
 * Ball scoring constants - both modes use balls 4-15
 */
export const SCORABLE_BALLS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

export const BALL_VALUES: Record<number, number> = {
  [BREAK_BALL_ID]: 6, // Break ball: labeled "3" on the table, worth 6 points
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
  12: 12,
  13: 13,
  14: 14,
  15: 15,
};

// 114 (sum of 4..15) + 6 (Break ball) = 120
export const TOTAL_TABLE_POINTS =
  SCORABLE_BALLS.reduce((sum, ball) => sum + (BALL_VALUES[ball] ?? ball), 0) +
  BALL_VALUES[BREAK_BALL_ID];

export const SPOT_POOL_RULES = {
  breakValue: 6, // points for pocketing the Break ball
  minPlayers: 3,
  maxPlayers: 999,
  ballValues: BALL_VALUES,
  totalTablePoints: TOTAL_TABLE_POINTS,
} as const;

export const FACE_MODE_RULES = {
  playerCount: 2,
  scoringMethod: 'DIFFERENTIAL' as const, // P1_potted - P2_potted
  ballValues: BALL_VALUES,
  totalTablePoints: TOTAL_TABLE_POINTS,
} as const;

/**
 * Penalty types and descriptions
 */
export const PENALTY_TYPES = {
  WRONG_TARGET: 'Wrong Target',
  SCRATCH: 'Scratch',
} as const;

/**
 * Player status
 */
export const PLAYER_STATUS = {
  ACTIVE: 'ACTIVE',
  DEACTIVATED: 'DEACTIVATED',
} as const;

/**
 * Game mode
 */
export const GAME_MODE = {
  SPOT_POOL: 'SPOT_POOL',
  FACE_MODE: 'FACE_MODE',
} as const;

/**
 * Game status
 */
export const GAME_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;