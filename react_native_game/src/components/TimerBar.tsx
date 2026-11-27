import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { gameStore } from '../store';
import { C, mono } from '../theme';

/** Drives gameStore.tick() every frame and draws the time left for the current command. */
export function TimerBar() {
  const [left, setLeft] = useState<{ frac: number; secs: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      gameStore.getState().tick();
      const p = gameStore.getState().prompt;
      if (p?.deadline && p.timeLimitMs) {
        const ms = Math.max(0, p.deadline - Date.now());
        setLeft({ frac: Math.min(1, ms / p.timeLimitMs), secs: ms / 1000 });
      } else {
        setLeft(null);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!left) return <View style={{ height: 18 }} />;
  const color = left.frac < 0.3 ? C.blood : left.frac < 0.6 ? C.candle : C.bone;
  return (
    <View style={styles.row}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${left.frac * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.secs}>{left.secs.toFixed(1)}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: 420, alignSelf: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(232,228,216,0.1)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  secs: { width: 48, textAlign: 'right', color: C.dim, fontFamily: mono, fontSize: 12 },
});
