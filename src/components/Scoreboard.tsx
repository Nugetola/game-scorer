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
    paddingHorizontal: 10,
    marginVertical: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  scoreList: {
    width: '100%',
  },
  scoreCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 7,
    marginBottom: 4,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    borderLeftWidth: 3,
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
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
    fontSize: 12,
  },
  playerInfo: {
    flex: 1,
    marginRight: 8,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  deactivatedText: {
    textDecorationLine: 'line-through',
  },
  statusText: {
    fontSize: 9,
    color: '#f44336',
    marginTop: 1,
  },
  scoreInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: 130,
  },
  scoreColumn: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 9,
    color: '#999',
    marginBottom: 1,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
});