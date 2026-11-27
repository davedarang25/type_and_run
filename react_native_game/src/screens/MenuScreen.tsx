import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiRepository } from '../repositories/apiRepository';
import { LocalRepository } from '../repositories/localRepository';
import type { PlaceCard } from '../repositories/types';
import { gameStore, repository, useGame } from '../store';
import { C, DIFF_COLOR, T } from '../theme';

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[T.label, { color, fontSize: 10 }]}>{text}</Text>
    </View>
  );
}

function Card({ card, width }: { card: PlaceCard; width: number | '100%' }) {
  const { place, progress, unlocked } = card;
  return (
    <Pressable
      disabled={!unlocked}
      onPress={() => gameStore.getState().selectPlace(place.place_id)}
      style={({ pressed }) => [T.card, styles.card, { width }, !unlocked && { opacity: 0.45 }, pressed && { borderColor: 'rgba(232,228,216,0.4)' }]}
    >
      <View style={styles.badges}>
        <Badge text={place.difficulty} color={DIFF_COLOR[place.difficulty]} />
        {progress?.ritual_completed && <Badge text="exorcised" color={C.ecto} />}
        {progress?.exploration_completed && !progress.ritual_completed && <Badge text="explored" color={C.dim} />}
        {!unlocked && <Text style={[T.label, { fontSize: 10 }]}>🔒 clear the previous location</Text>}
      </View>
      <Text style={[T.display, { fontSize: 26 }]}>{place.place_name}</Text>
      <Text style={[T.dim, { lineHeight: 18 }]}>{place.description}</Text>
      <View style={styles.badges}>
        <Text style={T.dim}>Best WPM <Text style={T.text}>{progress?.best_wpm ?? '—'}</Text></Text>
        <Text style={T.dim}>Best accuracy <Text style={T.text}>{progress?.best_accuracy != null ? `${progress.best_accuracy}%` : '—'}</Text></Text>
      </View>
    </Pressable>
  );
}

export function MenuScreen() {
  const places = useGame((s) => s.places);
  const player = useGame((s) => s.player);
  const error = useGame((s) => s.error);
  const items = useGame((s) => s.items);
  const stash = useGame((s) => s.userInventory);
  const cleared = places.filter((p) => p.progress?.exploration_completed).length;
  const exorcised = places.filter((p) => p.progress?.ritual_completed).length;
  const stashText = Object.entries(stash).map(([id, q]) => `${items.find((i) => i.item_id === Number(id))?.item_name ?? id} ×${q}`).join(', ');
  const online = repository instanceof ApiRepository ? repository : null;
  const offline = repository instanceof LocalRepository ? repository : null;

  // Same grid as the Flutter menu: 2 columns when there's room (2×2 for 4 places), 1 on phones.
  const [gridWidth, setGridWidth] = useState(0);
  const cols = gridWidth > 640 ? 2 : 1;
  const cardWidth = cols === 2 ? (gridWidth - GAP) / 2 : '100%';

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={[T.label, { color: C.blood }]}>● REC</Text>
      <Text style={[T.display, { fontSize: 48 }]}>Type-to-Run</Text>
      <Text style={[T.dim, { lineHeight: 19, maxWidth: 560 }]}>
        You're a paranormal streamer. Every step, every hiding spot, every word of the rite is typed. Typos and hesitation draw them closer.
        Explore and leave alive, or gather what the ritual needs and end the haunting.
      </Text>
      <View style={styles.stats}>
        <Text style={T.dim}>Streamer <Text style={T.text}>{player?.username}</Text></Text>
        <Text style={T.dim}>Cleared <Text style={T.text}>{cleared}/{places.length}</Text></Text>
        <Text style={T.dim}>Exorcisms <Text style={T.text}>{exorcised}</Text></Text>
        <Text style={T.dim}>Stash <Text style={T.text}>{stashText || 'empty'}</Text></Text>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
        {places.map((c) => <Card key={c.place.place_id} card={c} width={cardWidth} />)}
      </View>
      <View style={styles.footer}>
        <Text style={[T.dim, { flex: 1 }]}>
          {offline ? 'Offline mode — progress saved on this device.' : 'Online — progress saved to your account.'}
        </Text>
        {online && (
          <Pressable onPress={() => { online.logout(); void gameStore.getState().init(); }}>
            <Text style={[T.dim, styles.link]}>sign out</Text>
          </Pressable>
        )}
        {offline && (
          <Pressable onPress={() => { offline.reset(); void gameStore.getState().init(); }}>
            <Text style={[T.dim, styles.link]}>reset offline save</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const GAP = 16;

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 32, gap: 12, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  error: { color: C.blood, borderColor: C.blood, borderWidth: 1, borderRadius: 6, padding: 10, fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  link: { textDecorationLine: 'underline' },
});