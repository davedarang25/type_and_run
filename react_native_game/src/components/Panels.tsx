// Ghost proximity meter, ritual inventory and stream log.
import { StyleSheet, Text, View } from 'react-native';
import type { ItemQuantities, ItemRow, ItemType, PlaceGhost } from '../types/db';
import type { LogEntry } from '../store';
import { C, T } from '../theme';

export function GhostMeter({ proximity, ghost, chasing }: { proximity: number; ghost: PlaceGhost | null; chasing: boolean }) {
  const segments = 20;
  const lit = Math.round((proximity / 100) * segments);
  const status = chasing ? 'HUNTING YOU' : proximity > 70 ? 'RIGHT BEHIND YOU' : proximity > 40 ? 'CLOSE' : proximity > 15 ? 'NEARBY' : 'QUIET';
  return (
    <View>
      <View style={styles.between}>
        <Text style={T.label}>EMF · Ghost proximity</Text>
        <Text style={T.dim}>{Math.round(proximity)}%</Text>
      </View>
      <View style={styles.meter} accessibilityLabel={`Ghost proximity ${Math.round(proximity)} percent`}>
        {Array.from({ length: segments }, (_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < lit ? (i < 8 ? C.ecto : i < 14 ? C.candle : C.blood) : 'rgba(232,228,216,0.07)' },
            ]}
          />
        ))}
      </View>
      <Text style={[T.dim, (chasing || proximity > 70) && { color: C.blood }]}>
        {status}
        {ghost && (chasing || proximity > 40) ? ` — ${ghost.ghost_name}` : ''}
      </Text>
    </View>
  );
}

const ICON: Record<ItemType, string> = { ritual_salt: '◇', relic: '✝', candle: '♨', talisman: '✶' };

export function InventoryPanel({ items, session, stash, required }: {
  items: ItemRow[];
  session: ItemQuantities;
  stash: ItemQuantities;
  required: ItemQuantities;
}) {
  const ids = [...new Set([...Object.keys(required), ...Object.keys(session), ...Object.keys(stash)].map(Number))];
  return (
    <View style={{ gap: 6 }}>
      <Text style={T.label}>Ritual items</Text>
      {ids.length === 0 && <Text style={T.dim}>Nothing yet.</Text>}
      {ids.map((id) => {
        const item = items.find((i) => i.item_id === id);
        if (!item) return null;
        const have = (session[id] ?? 0) + (stash[id] ?? 0);
        const need = required[id];
        const ok = need !== undefined && have >= need;
        return (
          <View key={id} style={styles.itemRow}>
            <Text style={[T.text, { width: 18, color: ok ? C.ecto : need ? C.candle : C.dim }]}>{ICON[item.item_type]}</Text>
            <Text style={[T.text, { flex: 1 }]} numberOfLines={1}>{item.item_name}</Text>
            <Text style={[T.dim, ok && { color: C.ecto }]}>{have}{need !== undefined ? ` / ${need}` : ''}</Text>
          </View>
        );
      })}
      {Object.keys(session).length > 0 && <Text style={[T.dim, { fontSize: 11 }]}>Found this run: banked when you leave alive.</Text>}
    </View>
  );
}

const TONE: Record<LogEntry['tone'], object> = {
  info: { color: 'rgba(232,228,216,0.7)' },
  good: { color: C.ecto },
  bad: { color: C.candle },
  ghost: { color: C.blood, fontWeight: 'bold' },
};

export function EventLog({ log }: { log: LogEntry[] }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={T.label}>Stream log</Text>
      {log.map((e, i) => (
        <Text key={e.id} style={[T.dim, { lineHeight: 18, opacity: 1 - i * 0.14 }, TONE[e.tone]]}>
          {e.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  meter: { flexDirection: 'row', gap: 3, marginBottom: 8 },
  segment: { flex: 1, height: 14, borderRadius: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
