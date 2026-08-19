/**
 * Scoreboard Component - Displays current player scores and leaderboard
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GameScore } from '../types';

interface ScoreboardProps {
  scores: GameScore[];
  gameMode?: string;
  leaderScore: number;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ scores, leaderScore }) => {
  const sortedScores = [...scores].sort((a, b) => {
    // Active first, then by score
    if (a.status !== b.status) {
      return a.status === 'ACTIVE' ? -1 : 1;
    }
    return b.currentScore - a.currentScore;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 Leaderboard</Text>
      
      <View style={styles.scoreList}>
        {sortedScores.map((score, index) => {
          const isLeader = score.currentScore === leaderScore && score.status === 'ACTIVE';
          const isDeactivated = score.status === 'DEACTIVATED';

          return (
            <View
              key={score.id}
              style={[
                styles.scoreCard,
                isDeactivated && styles.deactivatedCard,
                isLeader && styles.leaderCard,
              ]}
            >
              <View
                style={[
                  styles.rankBadge,
                  isLeader && styles.leaderRankBadge,
                  isDeactivated && styles.deactivatedRankBadge,
                ]}
              >
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>

              <View style={styles.playerInfo}>
                <Text style={[styles.playerName, isDeactivated && styles.deactivatedText]}>
                  {score.playerName}
                </Text>
                {isDeactivated && (
                  <Text style={styles.statusText}>❌ DEACTIVATED</Text>
                )}
              </View>

              <View style={styles.scoreInfo}>
                <View style={styles.scoreColumn}>
                  <Text style={styles.scoreLabel}>Score</Text>
                  <Text style={styles.scoreValue}>{score.currentScore}</Text>
                </View>

                <View style={styles.scoreColumn}>
                  <Text style={styles.scoreLabel}>Max Pot.</Text>
                  <Text style={styles.scoreValue}>{score.maxPotential}</Text>
                </View>

                <View style={styles.scoreColumn}>
                  <Text style={styles.scoreLabel}>Balls</Text>
                  <Text style={styles.scoreValue}>{score.pottedBalls.length}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    marginVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  scoreList: {
    width: '100%',
  },
  scoreCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  leaderCard: {
    borderLeftColor: '#FFD700',
    backgroundColor: '#FFFDE7',
  },
  deactivatedCard: {
    opacity: 0.6,
    borderLeftColor: '#9E9E9E',
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  leaderRankBadge: {
    backgroundColor: '#FFB300',
  },
  deactivatedRankBadge: {
    backgroundColor: '#9E9E9E',
  },
  rankText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  playerInfo: {
    flex: 1,
    marginRight: 12,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  deactivatedText: {
    textDecorationLine: 'line-through',
  },
  statusText: {
    fontSize: 11,
    color: '#f44336',
    marginTop: 2,
  },
  scoreInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: 140,
  },
  scoreColumn: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
});