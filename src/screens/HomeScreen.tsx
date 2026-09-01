/**
 * Home Screen - Main menu for starting a new game or loading an existing one
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { usePlayerStore, useGameStore } from '../store';

type ScreenName = 'HOME' | 'GAME';

interface HomeScreenProps {
  onNavigate: (screen: ScreenName) => void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { players, fetchPlayers, addPlayer, updatePlayer } = usePlayerStore();
  const { startNewGame } = useGameStore();

  const [newPlayerName, setNewPlayerName] = useState('');
  const [gameMode, setGameMode] = useState<'SPOT_POOL' | 'FACE_MODE' | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  // ✅ HAARAA: maqaa taphataa gulaaluuf (edit) — id-ii taphataa amma
  // gulaalamaa jiruu fi barreeffama haaraa isaa tokkicha of keessatti qaba.
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Find the next unused letter (A, B, C...) based on existing player names
  const getNextLetterName = (): string => {
    const existingNames = new Set(players.map((p) => p.name.toUpperCase()));
    for (const letter of ALPHABET) {
      if (!existingNames.has(letter)) {
        return letter;
      }
    }
    // Fallback if all 26 letters are taken: A1, A2, A3...
    let suffix = 1;
    while (existingNames.has(`A${suffix}`)) {
      suffix++;
    }
    return `A${suffix}`;
  };

  const handleQuickAddPlayer = async () => {
    const nextName = getNextLetterName();
    setQuickAddLoading(true);
    try {
      const player = await addPlayer(nextName);
      if (!player) {
        Alert.alert('Error', `Could not add player "${nextName}". It may already exist.`);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create player');
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleCreatePlayer = async () => {
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a player name');
      return;
    }

    try {
      const player = await addPlayer(trimmedName);
      if (!player) {
        Alert.alert('Error', `Could not add player "${trimmedName}". It may already exist.`);
        return;
      }
      setNewPlayerName('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create player');
    }
  };

  const startEditingPlayer = (playerId: string, currentName: string) => {
    setEditingPlayerId(playerId);
    setEditingName(currentName);
  };

  const cancelEditingPlayer = () => {
    setEditingPlayerId(null);
    setEditingName('');
  };

  const handleSaveRename = async (playerId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Player name cannot be empty');
      return;
    }

    setRenameLoading(true);
    try {
      const success = await updatePlayer(playerId, trimmed);
      if (success) {
        cancelEditingPlayer();
      } else {
        Alert.alert('Error', `Could not rename to "${trimmed}". It may already exist.`);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to rename player');
    } finally {
      setRenameLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!gameMode) {
      Alert.alert('Error', 'Please select a game mode first');
      return;
    }

    if (selectedPlayerIds.length === 0) {
      Alert.alert('Error', 'Please select at least one player');
      return;
    }

    if (gameMode === 'FACE_MODE' && selectedPlayerIds.length !== 2) {
      Alert.alert('Error', 'Face Mode requires exactly 2 players');
      return;
    }

    if (gameMode === 'SPOT_POOL' && selectedPlayerIds.length < 3) {
      Alert.alert('Error', 'Spot Pool requires at least 3 players');
      return;
    }

    setLoading(true);
    try {
      const selectedPlayersObjects = players
        .filter((p) => selectedPlayerIds.includes(p.id))
        .map((p) => ({ id: p.id, name: p.name }));

      const success = await startNewGame(gameMode, selectedPlayersObjects);
      if (success) {
        setSelectedPlayerIds([]);
        setGameMode(null);
        onNavigate('GAME');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerSelect = (playerId: string) => {
    const isSelected = selectedPlayerIds.includes(playerId);
    if (isSelected) {
      setSelectedPlayerIds(selectedPlayerIds.filter((id) => id !== playerId));
    } else {
      if (gameMode === 'FACE_MODE' && selectedPlayerIds.length >= 2) {
        Alert.alert('Limit Reached', 'Face Mode only supports 2 players');
        return;
      }
      setSelectedPlayerIds([...selectedPlayerIds, playerId]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🎱 Spot Pool & Face Mode</Text>
        <Text style={styles.subtitle}>Scorekeeper</Text>
      </View>

      {/* Game Mode Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Game Mode</Text>
        <TouchableOpacity
          style={[
            styles.modeButton,
            gameMode === 'SPOT_POOL' && styles.modeButtonActive,
          ]}
          onPress={() => {
            setGameMode('SPOT_POOL');
            setSelectedPlayerIds([]);
          }}
        >
          <Text style={styles.modeButtonText}>
            {gameMode === 'SPOT_POOL' ? '✅' : '⭕'} Spot Pool (3+ Players)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeButton,
            gameMode === 'FACE_MODE' && styles.modeButtonActive,
          ]}
          onPress={() => {
            setGameMode('FACE_MODE');
            setSelectedPlayerIds([]);
          }}
        >
          <Text style={styles.modeButtonText}>
            {gameMode === 'FACE_MODE' ? '✅' : '⭕'} Face Mode (2 Players)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Player Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create New Player</Text>

        {/* Quick Add (A, B, C...) */}
        <TouchableOpacity
          style={styles.quickAddButton}
          onPress={handleQuickAddPlayer}
          disabled={quickAddLoading}
        >
          {quickAddLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.quickAddButtonText}>
              ⚡ Quick Add ({getNextLetterName()})
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Or enter a custom name"
            value={newPlayerName}
            onChangeText={setNewPlayerName}
            placeholderTextColor="#999"
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.createButton} onPress={handleCreatePlayer}>
            <Text style={styles.createButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Player Selection */}
      {gameMode && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Select Players ({selectedPlayerIds.length}
            {gameMode === 'FACE_MODE' ? '/2' : gameMode === 'SPOT_POOL' ? '/3+' : ''})
          </Text>
          {players.map((item) => {
            const isSelected = selectedPlayerIds.includes(item.id);
            const isEditing = editingPlayerId === item.id;

            if (isEditing) {
              return (
                <View key={item.id} style={[styles.playerItem, styles.playerItemEditing]}>
                  <TextInput
                    style={styles.editInput}
                    value={editingName}
                    onChangeText={setEditingName}
                    autoFocus
                    autoCapitalize="words"
                    autoCorrect={false}
                    placeholderTextColor="#999"
                  />
                  <TouchableOpacity
                    style={styles.editSaveButton}
                    onPress={() => handleSaveRename(item.id)}
                    disabled={renameLoading}
                  >
                    {renameLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.editButtonText}>✓</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editCancelButton}
                    onPress={cancelEditingPlayer}
                    disabled={renameLoading}
                  >
                    <Text style={styles.editButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.playerItem,
                  isSelected && styles.playerItemSelected,
                ]}
                onPress={() => handlePlayerSelect(item.id)}
              >
                <Text style={styles.playerItemCheckbox}>
                  {isSelected ? '✅' : '⭕'}
                </Text>
                <Text style={styles.playerItemName}>{item.name}</Text>
                <TouchableOpacity
                  style={styles.editIconButton}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    startEditingPlayer(item.id, item.name);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.editIcon}>✏️</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Start Game Button */}
      {gameMode && selectedPlayerIds.length > 0 && (
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartGame}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startButtonText}>🎮 Start Game</Text>
          )}
        </TouchableOpacity>
      )}

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  modeButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  modeButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f8f0',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  quickAddButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  quickAddButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 14,
    color: '#333',
  },
  createButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  playerItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  playerItemSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f8f0',
  },
  playerItemEditing: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  playerItemCheckbox: {
    marginRight: 10,
    fontSize: 16,
  },
  playerItemName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  editIconButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  editIcon: {
    fontSize: 14,
  },
  editInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  editSaveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  editCancelButton: {
    backgroundColor: '#9E9E9E',
    borderRadius: 6,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  startButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  spacer: {
    height: 32,
  },
});