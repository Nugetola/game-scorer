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

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { players, fetchPlayers, addPlayer } = usePlayerStore();
  const { startNewGame } = useGameStore();

  const [newPlayerName, setNewPlayerName] = useState('');
  const [gameMode, setGameMode] = useState<'SPOT_POOL' | 'FACE_MODE' | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const handleCreatePlayer = async () => {
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a player name');
      return;
    }

    try {
      await addPlayer(trimmedName);
      setNewPlayerName('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create player');
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
      // Map selectedPlayerIds to objects containing id and name for startNewGame
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
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter player name"
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