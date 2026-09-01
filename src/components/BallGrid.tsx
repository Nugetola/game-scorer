/**
 * Ball Grid Component - Shows all scorable balls (4-15), plus the
 * special Break ball (Score mode only).
 * Supports both "Potted" (positive) and "Penalty" (negative) modes
 */

import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SCORABLE_BALLS, BREAK_BALL_ID } from '../constants/rules';

type GridMode = 'POTTED' | 'PENALTY';

interface BallGridProps {
  mode: GridMode;
  onBallSelected: (ballValue: number) => void;
  disabled?: boolean;
  /**
   * If provided, only balls in this list are tappable — every other
   * ball renders greyed-out and non-pressable. Used in POTTED mode to
   * restrict input to the single legal target ball. Leave undefined
   * (e.g. in PENALTY mode) to allow any ball.
   */
  enabledBalls?: number[];
}

export const BallGrid: React.FC<BallGridProps> = ({
  mode,
  onBallSelected,
  disabled = false,
  enabledBalls,
}) => {
  const isPotted = mode === 'POTTED';
  const displayMode = isPotted ? 'Score Potted Ball' : 'Apply Penalty';
  const buttonColor = isPotted ? '#4CAF50' : '#f44336';
  const ballPrefix = isPotted ? '+' : '−';

  const isBallEnabled = (ball: number): boolean => {
    if (disabled) return false;
    if (!enabledBalls) return true;
    return enabledBalls.includes(ball);
  };

  const breakEnabled = isBallEnabled(BREAK_BALL_ID);

  return (
    <View style={styles.container}>
      <Text style={styles.modeLabel}>{displayMode}</Text>

      {/* ✅ HAARAA: "Break" ball — kubbaa addaa, Score mode qofa keessatti
          mul'ata (Penalty grid keessa hin argamu). +6 kenna. */}
      {isPotted && (
        <TouchableOpacity
          style={[styles.breakButton, { opacity: breakEnabled ? 1 : 0.3 }]}
          onPress={() => {
            if (breakEnabled) onBallSelected(BREAK_BALL_ID);
          }}
          disabled={!breakEnabled}
        >
          <Text style={styles.breakButtonText}>🎯 Break (+6)</Text>
        </TouchableOpacity>
      )}

      <View style={styles.gridContainer}>
        <View style={styles.ballRow}>
          {SCORABLE_BALLS.map((ball: number) => {
            const enabled = isBallEnabled(ball);
            return (
              <TouchableOpacity
                key={ball}
                style={[
                  styles.ballButton,
                  { backgroundColor: buttonColor, opacity: enabled ? 1 : 0.3 },
                ]}
                onPress={() => {
                  if (enabled) {
                    onBallSelected(ball);
                  }
                }}
                disabled={!enabled}
              >
                <Text style={styles.ballValue}>
                  {ballPrefix}{ball}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 10,
  },
  modeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  breakButton: {
    backgroundColor: '#FFB300',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    marginHorizontal: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  breakButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  gridContainer: {
    paddingHorizontal: 6,
  },
  ballRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  ballButton: {
    width: '23%',
    aspectRatio: 1.6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  ballValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});