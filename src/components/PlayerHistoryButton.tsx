import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useGameStore } from '../store';
import { pointValueForBall } from '../utils/gameLogic';
import { ActionLogEntry } from '../types';

interface Props {
  playerIdx: number;
  playerName: string;
}

/**
 * Small clock-icon button that opens a bottom-sheet modal listing this
 * ONE player's action history (pots + penalties), newest first. The most
 * recent entry is highlighted and is the one "Undo" (wherever you trigger
 * it from — the existing header Undo button or the button in this sheet)
 * will remove; removing it here and removing it from the header button
 * are the exact same store call, so the two stay in sync automatically.
 */
export default function PlayerHistoryButton({ playerIdx, playerName }: Props) {
  const [visible, setVisible] = useState(false);

  // Subscribing to actionLog (not just calling getPlayerHistory() once)
  // means this list re-renders live as new actions/undos happen while open.
  const actionLog = useGameStore((s) => s.actionLog);
  const undoLastActionForPlayer = useGameStore((s) => s.undoLastActionForPlayer);

  const history = actionLog
    .filter((e) => e.playerIdx === playerIdx)
    .slice()
    .reverse(); // newest first
  const lastEntryId = history[0]?.id;

  function describe(entry: ActionLogEntry) {
    if (entry.kind === 'POT') {
      const pts = pointValueForBall(entry.ballValue);
      return {
        label: entry.ballValue === 3 ? 'Break' : `Potted Ball ${entry.ballValue}`,
        value: `+${pts}`,
        color: '#2e7d32',
      };
    }
    const reasonLabel = entry.penaltyType === 'SCRATCH' ? 'Scratch' : 'Wrong Target';
    return {
      label: entry.reason ? `${reasonLabel} — ${entry.reason}` : reasonLabel,
      value: `-${entry.ballValue}`,
      color: '#c62828',
    };
  }

  return (
    <>
      <TouchableOpacity
        style={styles.historyBtn}
        onPress={() => setVisible(true)}
        accessibilityLabel={`${playerName} history`}
      >
        <Text style={styles.historyBtnText}>🕐</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{playerName} — History</Text>

            {history.length === 0 ? (
              <Text style={styles.empty}>No actions yet.</Text>
            ) : (
              <FlatList
                data={history}
                keyExtractor={(e) => e.id}
                renderItem={({ item }) => {
                  const d = describe(item);
                  const isLast = item.id === lastEntryId;
                  return (
                    <View style={[styles.row, isLast && styles.rowLast]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel}>{d.label}</Text>
                        {isLast && <Text style={styles.rowTag}>Last action</Text>}
                      </View>
                      <Text style={[styles.rowValue, { color: d.color }]}>{d.value}</Text>
                    </View>
                  );
                }}
              />
            )}

            {history.length > 0 && (
              <TouchableOpacity
                style={styles.undoBtn}
                onPress={() => undoLastActionForPlayer(playerIdx)}
              >
                <Text style={styles.undoBtnText}>↩ Undo last action</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  historyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
  },
  historyBtnText: { fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  empty: { color: '#888', textAlign: 'center', paddingVertical: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowLast: { backgroundColor: '#fff9e6', borderRadius: 8 },
  rowLabel: { fontSize: 15 },
  rowTag: { fontSize: 11, color: '#f9a825', marginTop: 2, fontWeight: '600' },
  rowValue: { fontSize: 15, fontWeight: '700' },
  undoBtn: {
    marginTop: 12,
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  undoBtnText: { color: '#e65100', fontWeight: '700' },
  closeBtn: { marginTop: 8, padding: 12, alignItems: 'center' },
  closeBtnText: { color: '#1976d2', fontWeight: '600' },
});