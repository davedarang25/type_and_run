import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Polygon, Rect } from 'react-native-svg';
import {
  corridorShapes,
  initialWalk,
  isWalkingPrompt,
  walkAdvance,
  walkKeystroke,
  walkPose,
  walkStep,
  walkStumble,
  type WalkState,
} from '../engine/walkCamera';
import { gameStore } from '../store';
import { C } from '../theme';

const TINT: Record<string, string> = { flickering: '#1a1810', misty: '#121820', sterile: '#0f1a18', flooded: '#0b1420' };

/** Realistic backrooms plates (photographic corridors behind the drawn one). */
const PLATE: Record<string, number> = {
  flickering: require('../../assets/backrooms/lobby.jpg'),
  misty: require('../../assets/backrooms/warehouse.jpg'),
  sterile: require('../../assets/backrooms/warehouse.jpg'),
  flooded: require('../../assets/backrooms/poolrooms.jpg'),
};
const CHASE_PLATE = require('../../assets/backrooms/chase.jpg');

/**
 * The "camera" viewport, carried by a walking streamer:
 *   the world layer (corridor + ghost) bobs with every keystroke on a movement word,
 *   lurches forward on each completed word, stumbles on typos, and runs during a chase.
 * The typed word (children) stays steady on top so it's always readable.
 */
export function CameraFeed({ proximity, chasing, atmosphere, children }: {
  proximity: number;
  chasing: boolean;
  atmosphere: string;
  children: ReactNode;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const walk = useRef<WalkState>(initialWalk());
  const [, setFrame] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  // Feed footsteps from the game: keystrokes, completed words, typos.
  useEffect(
    () =>
      gameStore.subscribe((s, prev) => {
        if (s.phase !== 'exploring' && s.phase !== 'exorcism') return;
        const walking = isWalkingPrompt(prev.prompt?.kind);
        if (walking && s.stats.correctKeystrokes > prev.stats.correctKeystrokes) walk.current = walkKeystroke(walk.current);
        if (s.playerDistance > prev.playerDistance) walk.current = walkStep(walk.current);
        if (s.typoAt !== prev.typoAt && prev.prompt?.kind !== 'choice') walk.current = walkStumble(walk.current);
      }),
    [],
  );

  // Animate every frame.
  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      walk.current = walkAdvance(walk.current, (now - last) / 1000, !!gameStore.getState().chase);
      last = now;
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 450, useNativeDriver: false }),
    ]));
    const d = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(drift, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ]));
    p.start();
    d.start();
    return () => { p.stop(); d.stop(); };
  }, [pulse, drift]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  const p = proximity / 100;
  const running = !!gameStore.getState().chase;
  const pose = walkPose(walk.current, running, size.h ? size.h / 400 : 1);
  const shapes = size.w ? corridorShapes(size.w, size.h, walk.current.depth, walk.current.t, atmosphere) : [];
  const borderColor = chasing
    ? pulse.interpolate({ inputRange: [0, 1], outputRange: ['rgba(224,49,63,0.25)', 'rgba(224,49,63,0.8)'] })
    : C.line;
  const ghostX = drift.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] });

  return (
    <Animated.View onLayout={onLayout} style={[styles.feed, { backgroundColor: TINT[atmosphere] ?? '#15161b', borderColor }]}>
      {/* the corridor the streamer is standing in */}
      <Image source={PLATE[atmosphere] ?? PLATE.flickering} resizeMode="cover" style={[StyleSheet.absoluteFill, styles.plate]} />
      {/* the same corridor once something starts running */}
      <Image source={CHASE_PLATE} resizeMode="cover" style={[StyleSheet.absoluteFill, styles.plate, { opacity: chasing ? 0.88 : 0 }]} />
      {/* world layer: moves with the walking camera */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: pose.x }, { translateY: pose.y }, { rotate: `${pose.roll}rad` }, { scale: 1.12 }] },
        ]}
      >
        {size.w > 0 && (
          <Svg width={size.w} height={size.h}>
            {shapes.map((s, i) =>
              s.kind === 'rect' ? (
                <Rect key={i} x={s.rect!.x} y={s.rect!.y} width={s.rect!.w} height={s.rect!.h} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.width} />
              ) : s.kind === 'poly' ? (
                <Polygon key={i} points={s.points!.map((q) => `${q.x},${q.y}`).join(' ')} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.width} />
              ) : (
                <Line key={i} x1={s.points![0].x} y1={s.points![0].y} x2={s.points![1].x} y2={s.points![1].y} stroke={s.stroke} strokeWidth={s.width} />
              ),
            )}
          </Svg>
        )}
        <Animated.View style={[styles.apparition, { opacity: Math.max(0, p * 0.8 - 0.05), transform: [{ translateX: ghostX }, { scale: 0.85 + p * 0.4 }] }]}>
          <View style={styles.head} />
          <View style={styles.body} />
        </Animated.View>
      </View>
      <View pointerEvents="none" style={styles.vignette} />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  feed: { borderWidth: 2, borderRadius: 12, overflow: 'hidden' },
  plate: { opacity: 0.95 },
  apparition: { position: 'absolute', top: '14%', alignSelf: 'center', alignItems: 'center' },
  head: { width: 48, height: 58, borderRadius: 30, backgroundColor: 'rgba(220,225,230,0.35)' },
  body: { width: 110, height: 200, marginTop: 4, borderTopLeftRadius: 60, borderTopRightRadius: 60, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, backgroundColor: 'rgba(200,205,215,0.18)' },
  vignette: { ...StyleSheet.absoluteFill, borderRadius: 12, borderWidth: 30, borderColor: 'rgba(0,0,0,0.35)' },
});
