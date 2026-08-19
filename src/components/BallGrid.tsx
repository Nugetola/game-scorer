/**
 * Ball Grid Component - Shows all scorable balls (4-15)
 * Supports both "Potted" (positive) and "Penalty" (negative) modes
 */

import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SCORABLE_BALLS } from '../constants/rules';

type GridMode = 'POTTED' | 'PENALTY';

interface BallGridProps {
  mode: GridMode;
  onBallSelected: (ballValue: number) => void;
  disabled?: boolean;
}

export const BallGrid: React.FC<BallGridProps> = ({ mode, onBallSelected, disabled = false }) => {
  const isPotted = mode === 'POTTED';
  const displayMode = isPotted ? 'Score Potted Ball' : 'Apply Penalty';
  const buttonColor = isPotted ? '#4CAF50' : '#f44336';
  const ballPrefix = isPotted ? '+' : '−';

  return (
    <View style={styles.container}>
      <Text style={styles.modeLabel}>{displayMode}</Text>
      
      <View style={styles.gridContainer}>
        <View style={styles.ballRow}>
          {SCORABLE_BALLS.map((ball: number) => (
            <TouchableOpacity
              key={ball}
              style={[
                styles.ballButton,
                { backgroundColor: buttonColor, opacity: disabled ? 0.5 : 1 },
              ]}
              onPress={() => {
                if (!disabled) {
                  onBallSelected(ball);
                }
              }}
              disabled={disabled}
            >
              <Text style={styles.ballValue}>
                {ballPrefix}{ball}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 12,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  gridContainer: {
    paddingHorizontal: 8,
  },
  ballRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  ballButton: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  ballValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});