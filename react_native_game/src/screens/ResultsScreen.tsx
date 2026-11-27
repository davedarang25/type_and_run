import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TypingPrompt } from '../components/TypingPrompt';
import { useGame } from '../store';
import { C, T } from '../theme';

function Stat({ label, value, best }: { label: string; value: string; best?: boolean }) {
  return (
    <View style={[T.card, styles.stat]}>
      <Text style={T.label}>{label}</Text>
      <Text style={[T.text, { fontSize: 24 }]}>{value}</Text>
      {best && <Text style={[T.dim, { color: C.ecto }]}>new best</Text>}
    </View>
  );
}

export function ResultsScreen() {
  const r = useGame((s) => s.result)!;
  const prompt = useGame((s) => s.prompt);
  const buffer = useGame((s) => s.buffer);
  const typoAt = useGame((s) => s.typoAt);
  const items = useGame((s) => s.items);
  const caught = r.outcome === 'caught';
  const newWpm = !caught && (r.previousBest.wpm ?? 0) < r.wpm;
  const newAcc = !caught && (r.previousBest.accuracy ?? 0) < r.accuracy;
  const found = Object.entries(r.itemsFound).map(([id, q]) => `${items.find((i) => i.item_id === Number(id))?.item_name} ×${q}`);
  const headline = caught ? 'SIGNAL LOST' : r.outcome === 'exorcised' ? 'Haunting ended' : 'Stream saved';
  const sub = caught
    ? `${r.caughtBy} caught you in ${r.placeName}. Everything you found this run is gone.`
    : r.outcome === 'exorcised'
      ? `You exorcised ${r.placeName}. Ritual items consumed.`
      : `You made it out of ${r.placeName} with the footage.`;

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="always">
      <Text style={[T.display, { fontSize: 46, color: caught ? C.blood : C.bone }]}>{headline}</Text>
      <Text style={T.dim}>{sub}</Text>
      {r.saveError && <Text style={styles.error}>Could not save: {r.saveError}</Text>}
      <View style={styles.stats}>
        <Stat label="WPM" value={r.wpm.toFixed(1)} best={newWpm} />
        <Stat label="Accuracy" value={`${r.accuracy.toFixed(1)}%`} best={newAcc} />
        <Stat label="Rooms" value={String(r.roomsExplored)} />
        <Stat label="Chases survived" value={String(r.chasesSurvived)} />
      </View>
      <Text style={T.dim}>
        {Math.floor(r.durationSec / 60)}m {String(r.durationSec % 60).padStart(2, '0')}s live · {r.stepsTaken} steps · items: {found.length ? found.join(', ') : 'none'}
      </Text>
      <View style={{ marginTop: 24 }}>{prompt && <TypingPrompt prompt={prompt} buffer={buffer} typoAt={typoAt} />}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 22, paddingTop: 48, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  stat: { flexGrow: 1, flexBasis: 140, gap: 4 },
  error: { color: C.blood, fontSize: 13 },
});
