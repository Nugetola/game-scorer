import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Database } from './src/db';
import { useGameStore, usePlayerStore } from './src/store';
import { HomeScreen, GameScreen } from './src/screens';

type AppScreen = 'HOME' | 'GAME';

export default function App() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('HOME');

  const { fetchPlayers } = usePlayerStore();
  const { activeGame, loadActiveGame } = useGameStore();
  const gameId = activeGame?.id;

  const isInitializing = useRef(false);

  const initializeApp = async () => {
    setError(null);
    try {
      // Initialize SQLite DB
      await Database.init();

      // Load player state safely
      await fetchPlayers();

      // Attempt to restore any unfinished game session
      await loadActiveGame();

      setDbInitialized(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize database';
      console.error('App initialization error:', err);
      setError(errorMessage);
    } finally {
      isInitializing.current = false;
    }
  };

  useEffect(() => {
    if (isInitializing.current) return;
    isInitializing.current = true;
    initializeApp();
  }, []);

  // Auto-navigate to GAME if active game session was restored
  useEffect(() => {
    if (dbInitialized && gameId) {
      setCurrentScreen('GAME');
    }
  }, [dbInitialized, gameId]);

  if (!dbInitialized) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          {error ? (
            <>
              <Text style={styles.errorText}>❌ Initialization Error</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={initializeApp}>
                <Text style={styles.retryButtonText}>🔄 Retry</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Initializing Game Scorer...</Text>
            </>
          )}
          <StatusBar style="light" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.appContainer}>
        {currentScreen === 'HOME' && (
          <HomeScreen onNavigate={(screen) => setCurrentScreen(screen as AppScreen)} />
        )}

        {currentScreen === 'GAME' && gameId ? (
          <GameScreen onNavigate={(screen) => setCurrentScreen(screen as AppScreen)} />
        ) : currentScreen === 'GAME' ? (
          <HomeScreen onNavigate={(screen) => setCurrentScreen(screen as AppScreen)} />
        ) : null}

        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  appContainer: {
    flex: 1,
    backgroundColor: '#020617',
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});