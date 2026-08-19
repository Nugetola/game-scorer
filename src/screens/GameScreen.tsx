/**
 * Game Screen - Main gameplay interface with scoreboard and ball grid
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useGameStore } from '../store';
import { BallGrid, Scoreboard } from '../components';
import { GameRepository } from '../db/repository';

type GridMode = 'POTTED' | 'PENALTY';

interface GameScreenProps {
  onNavigate: (screen: 'HOME' | 'GAME') => void;
}

export default function GameScreen({ onNavigate }: GameScreenProps) {
  const {
    activeGame,
    scores,
    recordPottedBall,
    applyPenalty,
    getLeaderScore,
    getGameWinner,
    shouldGameBeComplete,
  } = useGameStore();

  const gameId = activeGame?.id;
  const gameMode = activeGame?.mode;

  const [gridMode, setGridMode] = useState<GridMode>('POTTED');
  const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(0);
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const leaderScore = getLeaderScore();
  const winner = getGameWinner();
  const isGameComplete = shouldGameBeComplete();

  // Auto-switch away from deactivated players
  useEffect(() => {
    if (scores[selectedPlayerIdx]?.status === 'DEACTIVATED') {
      const firstActiveIdx = scores.findIndex((s) => s.status === 'ACTIVE');
      if (firstActiveIdx !== -1) {
        setSelectedPlayerIdx(firstActiveIdx);
      }
    }
  }, [scores, selectedPlayerIdx]);

  // Check if game should end
  useEffect(() => {
    if (isGameComplete && winner) {
      setShowEndGameModal(true);
    }
  }, [isGameComplete, winner]);

  const handleBallSelected = async (ballValue: number) => {
    if (!gameId) {
      Alert.alert('Error', 'No active game');
      return;
    }

    setIsLoading(true);
    try {
      if (gridMode === 'POTTED') {
        await recordPottedBall(selectedPlayerIdx, ballValue);
      } else {
        await applyPenalty(selectedPlayerIdx, ballValue, 'WRONG_TARGET');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndGame = async () => {
    if (!gameId || !winner || !gameMode) return;

    setIsLoading(true);
    try {
      const repo = new GameRepository();
      
      const finalScores: Record<string, number> = {};
      scores.forEach((score) => {
        finalScores[score.playerId] = score.currentScore;
      });

      const game = await repo.getGameById(gameId);
      if (!game) throw new Error('Game not found');

      await repo.saveMatchHistory(
        gameId,
        gameMode,
        winner.playerId,
        finalScores,
        scores.map((s) => s.playerId),
        game.startedAt
      );

      await repo.completeGame(gameId, winner.playerId);

      Alert.alert('Game Over!', `🏆 ${winner.playerName} wins!`, [
        {
          text: 'Return to Home',
          onPress: () => {
            setShowEndGameModal(false);
            onNavigate('HOME');
          },
        },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to end game');
    } finally {
      setIsLoading(false);
    }
  };

  if (!gameId || !gameMode) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No active game</Text>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => onNavigate('HOME')}
        >
          <Text style={styles.homeButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentPlayer = scores[selectedPlayerIdx];
  const activeScores = scores.filter((s) => s.status === 'ACTIVE');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.gameMode}>
          {gameMode === 'SPOT_POOL' ? '🎱 Spot Pool' : '👥 Face Mode'}
        </Text>
        <TouchableOpacity
          style={styles.endGameButton}
          onPress={() => {
            if (activeScores.length === 1 || gameMode === 'FACE_MODE') {
              handleEndGame();
            } else {
              Alert.alert(
                'Game Active',
                'Continue playing or manually end the game when ready.',
                [{ text: 'OK' }]
              );
            }
          }}
        >
          <Text style={styles.endGameButtonText}>⏹️ End</Text>
        </TouchableOpacity>
      </View>

      {/* Scoreboard */}
      <Scoreboard scores={scores} gameMode={gameMode} leaderScore={leaderScore} />

      {/* Player Selection Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.playerTabsContainer}
        contentContainerStyle={styles.playerTabs}
      >
        {scores.map((score, idx) => (
          <TouchableOpacity
            key={score.id}
            style={[
              styles.playerTab,
              selectedPlayerIdx === idx && styles.playerTabActive,
              score.status === 'DEACTIVATED' && styles.playerTabDeactivated,
            ]}
            onPress={() => setSelectedPlayerIdx(idx)}
            disabled={score.status === 'DEACTIVATED'}
          >
            <Text style={styles.playerTabText}>{score.playerName}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Mode Toggle */}
      <View style={styles.modeToggleContainer}>
        <TouchableOpacity
          style={[
            styles.modeToggleButton,
            gridMode === 'POTTED' && styles.modeToggleActive,
          ]}
          onPress={() => setGridMode('POTTED')}
        >
          <Text style={styles.modeToggleText}>⬆️ Score</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeToggleButton,
            gridMode === 'PENALTY' && styles.modeToggleActive,
          ]}
          onPress={() => setGridMode('PENALTY')}
        >
          <Text style={styles.modeToggleText}>⬇️ Penalty</Text>
        </TouchableOpacity>
      </View>

      {/* Ball Grid */}
      {currentPlayer && currentPlayer.status === 'ACTIVE' && (
        <BallGrid
          mode={gridMode}
          onBallSelected={handleBallSelected}
          disabled={isLoading}
        />
      )}

      {/* End Game Modal */}
      <Modal
        transparent
        visible={showEndGameModal}
        animationType="fade"
        onRequestClose={() => setShowEndGameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🏆 Game Complete!</Text>
            <Text style={styles.modalSubtitle}>
              {winner?.playerName} is the winner!
            </Text>
            <Text style={styles.modalScore}>
              Final Score: {winner?.currentScore} points
            </Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleEndGame}
              disabled={isLoading}
            >
              <Text style={styles.modalButtonText}>
                {isLoading ? '🔄' : '✅'} Return Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 8,
  },
  gameMode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  endGameButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  endGameButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  playerTabsContainer: {
    maxHeight: 48,
    marginVertical: 12,
  },
  playerTabs: {
    paddingHorizontal: 12,
    gap: 8,
  },
  playerTab: {
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  playerTabActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  playerTabDeactivated: {
    opacity: 0.4,
  },
  playerTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  modeToggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  modeToggleButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  modeToggleActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 32,
  },
  homeButton: {
    marginTop: 16,
    marginHorizontal: 32,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  modalScore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});