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
} from 'react-native';
import { useGameStore } from '../store';
import { BallGrid, Scoreboard } from '../components';
import { SCORABLE_BALLS, BREAK_BALL_ID } from '../constants/rules';
import { GameMode, PenaltyType } from '../types';

type GridMode = 'POTTED' | 'PENALTY';
type ModalStage = 'DETECTED' | 'FINISHED';

interface GameScreenProps {
  onNavigate: (screen: 'HOME' | 'GAME') => void;
}

export default function GameScreen({ onNavigate }: GameScreenProps) {
  const {
    activeGame,
    scores,
    recordPottedBall,
    applyPenalty,
    undoLastActionForPlayer,
    getPlayerHistory,
    cancelGame,
    finishGame,
    startNewGame,
    winnerHoldActive,
    holdWinnerAlert,
    getLeaderScore,
    getGameWinner,
    shouldGameBeComplete,
    getTargetBall,
  } = useGameStore();

  const gameId = activeGame?.id;
  const gameMode = activeGame?.mode;

  const [gridMode, setGridMode] = useState<GridMode>('POTTED');
  const [penaltyType, setPenaltyType] = useState<PenaltyType>('WRONG_TARGET');
  // No turn concept anymore — the scorekeeper picks whichever player they
  // want at any time. Defaults to the first player when a game starts.
  const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(0);
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [modalStage, setModalStage] = useState<ModalStage>('DETECTED');
  const [isLoading, setIsLoading] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Captured right before finishGame() clears the store, so the
  // "FINISHED" modal stage and "New Game (Same Players)" still have
  // something to show/reuse after activeGame/scores are gone.
  const [finishedWinnerName, setFinishedWinnerName] = useState('');
  const [lastGameSetup, setLastGameSetup] = useState<{
    mode: GameMode;
    players: { id: string; name: string }[];
  } | null>(null);

  const leaderScore = getLeaderScore();
  const winner = getGameWinner();
  const isGameComplete = shouldGameBeComplete();
  const targetBall = getTargetBall();

  // Per-player history/undo: the Undo button always acts on whichever
  // player's tab is currently selected.
  const selectedPlayerHistory = getPlayerHistory(selectedPlayerIdx);
  const canUndo = selectedPlayerHistory.length > 0;

  // Reset player selection whenever a (new) game starts.
  useEffect(() => {
    setSelectedPlayerIdx(0);
  }, [gameId]);

  useEffect(() => {
    if (scores[selectedPlayerIdx]?.status === 'DEACTIVATED') {
      const firstActiveIdx = scores.findIndex((s) => s.status === 'ACTIVE');
      if (firstActiveIdx !== -1) {
        setSelectedPlayerIdx(firstActiveIdx);
      }
    }
  }, [scores, selectedPlayerIdx]);

  // Automatic detection (Spot Pool): show the modal unless the referee has
  // put it on Hold. Any new action clears the hold, so if the condition
  // still holds afterward, this fires again.
  useEffect(() => {
    if (isGameComplete && winner && !winnerHoldActive) {
      setModalStage('DETECTED');
      setShowEndGameModal(true);
    }
  }, [isGameComplete, winner, winnerHoldActive]);

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
        await applyPenalty(selectedPlayerIdx, ballValue, penaltyType);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = async () => {
    setUndoLoading(true);
    try {
      await undoLastActionForPlayer(selectedPlayerIdx);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to undo');
    } finally {
      setUndoLoading(false);
    }
  };

  const handleCancelGame = () => {
    Alert.alert(
      'Cancel Game?',
      'This will end the current game without a winner and delete its scores. This cannot be undone.',
      [
        { text: 'Keep Playing', style: 'cancel' },
        {
          text: 'Cancel Game',
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            try {
              await cancelGame();
              onNavigate('HOME');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel game');
            } finally {
              setCancelLoading(false);
            }
          },
        },
      ]
    );
  };

  // Manual "End" button: always opens the same two-stage modal that the
  // automatic Spot Pool detection uses, at the DETECTED stage. If there's
  // no defensible winner yet (Spot Pool, more than one player still
  // active), warn instead of opening it.
  const handleEndButtonPress = () => {
    const activeCount = scores.filter((s) => s.status === 'ACTIVE').length;
    if (gameMode === 'FACE_MODE' || activeCount === 1) {
      setModalStage('DETECTED');
      setShowEndGameModal(true);
    } else {
      Alert.alert(
        'Game Active',
        'Continue playing or manually end the game when ready.',
        [{ text: 'OK' }]
      );
    }
  };

  // Modal — DETECTED stage — "Hold" button: keep playing, suppress the
  // alert until the next action changes something.
  const handleHold = () => {
    holdWinnerAlert();
    setShowEndGameModal(false);
  };

  // Modal — DETECTED stage — "Confirm Winner" button: persist match
  // history, then move to the FINISHED stage (New Game / Return Home).
  const handleConfirmWinner = async () => {
    if (!winner || !gameMode) return;

    setIsLoading(true);
    try {
      const finalScores: Record<string, number> = {};
      scores.forEach((s) => {
        finalScores[s.playerId] = s.currentScore;
      });
      const setup = {
        mode: gameMode,
        players: scores.map((s) => ({ id: s.playerId, name: s.playerName })),
      };

      await finishGame(winner.playerId, finalScores);

      setFinishedWinnerName(winner.playerName);
      setLastGameSetup(setup);
      setModalStage('FINISHED');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to finish game');
    } finally {
      setIsLoading(false);
    }
  };

  // Modal — FINISHED stage — "New Game (Same Players)"
  const handleNewGameSameSetup = async () => {
    if (!lastGameSetup) return;
    setIsLoading(true);
    try {
      const success = await startNewGame(lastGameSetup.mode, lastGameSetup.players);
      if (success) {
        setShowEndGameModal(false);
      } else {
        Alert.alert('Error', 'Failed to start new game');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to start new game');
    } finally {
      setIsLoading(false);
    }
  };

  // Modal — FINISHED stage — "Return Home"
  const handleReturnHome = () => {
    setShowEndGameModal(false);
    onNavigate('HOME');
  };

  const currentPlayer = gameId ? scores[selectedPlayerIdx] : undefined;

  const pottedAnywhere = new Set<number>();
  scores.forEach((s) => s.pottedBalls.forEach((b) => pottedAnywhere.add(b)));
  const remainingBalls = [BREAK_BALL_ID, ...SCORABLE_BALLS].filter((b) => !pottedAnywhere.has(b));

  const enabledBalls =
    gameMode === 'SPOT_POOL' && gridMode === 'POTTED' ? remainingBalls : undefined;

  const targetBallLabel = targetBall === BREAK_BALL_ID ? 'Break' : `Ball ${targetBall}`;

  return (
    <View style={styles.container}>
      {(!gameId || !gameMode) && !showEndGameModal ? (
        <>
          <Text style={styles.errorText}>No active game</Text>
          <TouchableOpacity style={styles.homeButton} onPress={() => onNavigate('HOME')}>
            <Text style={styles.homeButtonText}>Go Home</Text>
          </TouchableOpacity>
        </>
      ) : (
        gameId &&
        gameMode && (
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.gameMode}>
                {gameMode === 'SPOT_POOL' ? '🎱 Spot Pool' : '👥 Face Mode'}
              </Text>
              <View style={styles.headerButtons}>
                <TouchableOpacity
                  style={[styles.undoButton, !canUndo && styles.buttonDisabled]}
                  onPress={handleUndo}
                  disabled={!canUndo || undoLoading}
                >
                  <Text style={styles.headerButtonText}>
                    {undoLoading ? '...' : `↩️ Undo (${scores[selectedPlayerIdx]?.playerName ?? ''})`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelButton, cancelLoading && styles.buttonDisabled]}
                  onPress={handleCancelGame}
                  disabled={cancelLoading}
                >
                  <Text style={styles.headerButtonText}>
                    {cancelLoading ? '...' : '🗑️ Cancel'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.endGameButton} onPress={handleEndButtonPress}>
                  <Text style={styles.headerButtonText}>⏹️ End</Text>
                </TouchableOpacity>
              </View>
            </View>

            {gameMode === 'SPOT_POOL' && targetBall !== null && (
              <View style={styles.targetBanner}>
                <Text style={styles.targetBannerText}>
                  🎯 Must contact: {targetBallLabel} (any ball can pot)
                </Text>
              </View>
            )}

            {/* Scoreboard */}
            <Scoreboard scores={scores} gameMode={gameMode} leaderScore={leaderScore} />

            {/* Player Selection Tabs */}
            <View style={styles.playerTabsContainer}>
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
            </View>

            {/* Mode Toggle */}
            <View style={styles.modeToggleContainer}>
              <TouchableOpacity
                style={[styles.modeToggleButton, gridMode === 'POTTED' && styles.modeToggleActive]}
                onPress={() => setGridMode('POTTED')}
              >
                <Text style={styles.modeToggleText}>⬆️ Score</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeToggleButton, gridMode === 'PENALTY' && styles.modeToggleActive]}
                onPress={() => setGridMode('PENALTY')}
              >
                <Text style={styles.modeToggleText}>⬇️ Penalty</Text>
              </TouchableOpacity>
            </View>

            {/* Foul Type Selector — only in Penalty mode */}
            {gridMode === 'PENALTY' && (
              <View style={styles.foulTypeContainer}>
                <TouchableOpacity
                  style={[styles.foulTypeChip, penaltyType === 'WRONG_TARGET' && styles.foulTypeChipActive]}
                  onPress={() => setPenaltyType('WRONG_TARGET')}
                >
                  <Text style={[styles.foulTypeText, penaltyType === 'WRONG_TARGET' && styles.foulTypeTextActive]}>
                    Wrong Target
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.foulTypeChip, penaltyType === 'SCRATCH' && styles.foulTypeChipActive]}
                  onPress={() => setPenaltyType('SCRATCH')}
                >
                  <Text style={[styles.foulTypeText, penaltyType === 'SCRATCH' && styles.foulTypeTextActive]}>
                    Scratch
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Ball Grid */}
            {currentPlayer && currentPlayer.status === 'ACTIVE' && (
              <BallGrid
                mode={gridMode}
                onBallSelected={handleBallSelected}
                disabled={isLoading}
                enabledBalls={enabledBalls}
              />
            )}
          </>
        )
      )}

      {/* Winner Modal — two stages */}
      <Modal
        transparent
        visible={showEndGameModal}
        animationType="fade"
        onRequestClose={() => setShowEndGameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {modalStage === 'DETECTED' ? (
              <>
                <Text style={styles.modalTitle}>🏆 Possible Winner!</Text>
                <Text style={styles.modalSubtitle}>{winner?.playerName} is leading</Text>
                <Text style={styles.modalScore}>Score: {winner?.currentScore} points</Text>

                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleConfirmWinner}
                  disabled={isLoading}
                >
                  <Text style={styles.modalButtonText}>
                    {isLoading ? '🔄' : '✅'} Confirm Winner
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={handleHold}
                  disabled={isLoading}
                >
                  <Text style={styles.modalSecondaryButtonText}>⏸️ Hold — Not Yet</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>🏆 Game Saved!</Text>
                <Text style={styles.modalSubtitle}>{finishedWinnerName} won</Text>

                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleNewGameSameSetup}
                  disabled={isLoading}
                >
                  <Text style={styles.modalButtonText}>
                    {isLoading ? '🔄' : '🔁'} New Game (Same Players)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={handleReturnHome}
                  disabled={isLoading}
                >
                  <Text style={styles.modalSecondaryButtonText}>🏠 Return Home</Text>
                </TouchableOpacity>
              </>
            )}
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  gameMode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  undoButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cancelButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.6)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  endGameButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  targetBanner: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  targetBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E65100',
  },
  playerTabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginVertical: 12,
  },
  playerTab: {
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
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
  foulTypeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
    justifyContent: 'center',
  },
  foulTypeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#f44336',
    backgroundColor: '#fff',
  },
  foulTypeChipActive: {
    backgroundColor: '#f44336',
  },
  foulTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f44336',
  },
  foulTypeTextActive: {
    color: '#fff',
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
    marginBottom: 10,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  modalSecondaryButton: {
    borderRadius: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#9E9E9E',
  },
  modalSecondaryButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
});