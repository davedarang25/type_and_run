import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { lurkingGhost, STEPS_PER_ROOM } from '../engine/ghostAI';
import { requiredItems, ritualTargets } from '../engine/ritual';
import { repository, useGame } from '../store';
import { CameraFeed } from '../components/CameraFeed';
import { EventLog, GhostMeter, InventoryPanel } from '../components/Panels';
import { TimerBar } from '../components/TimerBar';
import { TypingPrompt } from '../components/TypingPrompt';
import { C, mono, T } from '../theme';

const PHASE_TEXT: Partial<Record<string, string>> = {
  decision: 'The room is clear. Push deeper for more items — or wrap up the stream?',
  ritualPrompt: 'Attempt the exorcism, or save the footage and go home?',
  insufficient: 'The ritual is incomplete. You need more items.',
  saving: 'Uploading footage…',
};

function StreamHeader({ title, viewers, startedAt }: { title: string; viewers: number; startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 600); return () => clearInterval(t); }, []);
  const secs = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const blink = Math.floor(now / 600) % 2 === 0;
  return (
    <View style={styles.header}>
      <View style={[styles.dot, { opacity: blink ? 1 : 0.2 }]} />
      <Text style={[T.label, { color: C.blood, fontWeight: 'bold' }]}>LIVE</Text>
      <Text style={[T.display, { fontSize: 17 }]} numberOfLines={1}>{title}</Text>
      <Text style={T.dim}>{String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</Text>
      <Text style={[T.dim, { marginLeft: 'auto' }]}>👁 {viewers}</Text>
      <Text style={[T.label, styles.mode]}>{repository.mode}</Text>
    </View>
  );
}

export function RunScreen() {
  const s = useGame((st) => st);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const content = s.content!;
  const required = useMemo(() => requiredItems(content), [content]);
  const boss = ritualTargets(content)[0];
  const chaseGhost = s.chase ? content.ghosts.find((g) => g.ghost_id === s.chase!.ghostId) ?? null : null;
  const hunting = !!s.chase || s.phase === 'exorcism';
  const itemsFound = Object.values(s.sessionInventory).reduce((a, b) => a + b, 0);
  const viewers = 24 + s.playerDistance * 9 + s.chasesSurvived * 70 + itemsFound * 18 + Math.round(s.ghostProximity * 2.2);

  const feed = (
    <CameraFeed proximity={s.ghostProximity} chasing={hunting} atmosphere={content.place.atmosphere}>
      <View style={styles.feedInner}>
        <View style={styles.between}>
          <Text style={T.label}>Room {s.room + 1} · step {Math.min(s.stepInRoom + 1, STEPS_PER_ROOM)}/{STEPS_PER_ROOM}</Text>
          <Text style={T.label}>{s.playerDistance} steps in</Text>
        </View>
        <View style={styles.center}>
          {chaseGhost && s.chase && (
            <Text style={[styles.alert, { color: C.blood }]}>
              {chaseGhost.ghost_name.toUpperCase()} — {s.chase.escapesDone}/{s.chase.escapesNeeded} TO LOSE IT
            </Text>
          )}
          {s.exorcism && (
            <Text style={[styles.alert, { color: C.candle }]}>RITE OF BANISHMENT — {s.exorcism.done}/{s.exorcism.needed}</Text>
          )}
          {PHASE_TEXT[s.phase] && <Text style={[T.text, styles.centerText]}>{PHASE_TEXT[s.phase]}</Text>}
          {s.phase === 'insufficient' &&
            s.missing.map((m) => (
              <Text key={m.item_id} style={[T.text, { color: C.candle }]}>
                {content.items.find((i) => i.item_id === m.item_id)?.item_name}: {m.have}/{m.needed}
              </Text>
            ))}
          {s.prompt && <TypingPrompt prompt={s.prompt} buffer={s.buffer} typoAt={s.typoAt} />}
          {s.prompt && <TimerBar />}
        </View>
        <Text style={[T.dim, styles.centerText, { fontSize: 11 }]}>
          {s.prompt?.kind === 'choice' ? 'Type an option (or tap it).' : 'Just type. Mistakes cost time and bring them closer.'}
        </Text>
      </View>
    </CameraFeed>
  );

  const sidebar = (
    <View style={[T.card, { gap: 22 }]}>
      <GhostMeter proximity={s.ghostProximity} ghost={chaseGhost ?? (s.phase === 'exorcism' ? boss : lurkingGhost(content.ghosts))} chasing={hunting} />
      <View style={{ gap: 4 }}>
        <Text style={T.label}>Target</Text>
        <Text style={T.text}>{boss?.ghost_name}</Text>
        <Text style={[T.dim, { lineHeight: 18 }]}>{boss?.description}</Text>
        <Text style={T.dim}>Weakness: <Text style={{ color: C.candle }}>{boss?.weakness}</Text></Text>
      </View>
      <InventoryPanel items={content.items} session={s.sessionInventory} stash={s.userInventory} required={required} />
      <EventLog log={s.log} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="always">
      <StreamHeader title={content.place.place_name} viewers={viewers} startedAt={s.sessionStartedAt} />
      {wide ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>{feed}</View>
          <View style={{ width: 300 }}>{sidebar}</View>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {feed}
          {sidebar}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 14, maxWidth: 1180, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.blood },
  mode: { borderWidth: 1, borderColor: C.line, borderRadius: 4, paddingHorizontal: 5, fontSize: 9 },
  row: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  feedInner: { minHeight: 360, padding: 18, justifyContent: 'space-between', gap: 20 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  center: { alignItems: 'stretch', gap: 14 },
  centerText: { textAlign: 'center' },
  alert: { fontFamily: mono, fontSize: 12, fontWeight: 'bold', letterSpacing: 2, textAlign: 'center' },
});
