import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { C } from '../theme';

const TINT: Record<string, string> = { flickering: '#1a1810', misty: '#121820', sterile: '#0f1a18', flooded: '#0b1420' };

/** The "camera" viewport: an apparition that fades in as proximity rises; red pulse in a chase. */
export function CameraFeed({ proximity, chasing, atmosphere, children }: {
  proximity: number;
  chasing: boolean;
  atmosphere: string;
  children: ReactNode;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

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

  const p = proximity / 100;
  const borderColor = chasing
    ? pulse.interpolate({ inputRange: [0, 1], outputRange: ['rgba(224,49,63,0.25)', 'rgba(224,49,63,0.8)'] })
    : C.line;
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] });

  return (
    <Animated.View style={[styles.feed, { backgroundColor: TINT[atmosphere] ?? '#15161b', borderColor }]}>
      <Animated.View pointerEvents="none" style={[styles.apparition, { opacity: Math.max(0, p * 0.8 - 0.05), transform: [{ translateX }] }]}>
        <View style={styles.head} />
        <View style={styles.body} />
      </Animated.View>
      <View pointerEvents="none" style={styles.vignette} />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  feed: { borderWidth: 2, borderRadius: 12, overflow: 'hidden' },
  apparition: { position: 'absolute', top: '8%', alignSelf: 'center', alignItems: 'center' },
  head: { width: 48, height: 58, borderRadius: 30, backgroundColor: 'rgba(220,225,230,0.35)' },
  body: { width: 110, height: 200, marginTop: 4, borderTopLeftRadius: 60, borderTopRightRadius: 60, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, backgroundColor: 'rgba(200,205,215,0.18)' },
  vignette: { ...StyleSheet.absoluteFill, borderRadius: 12, borderWidth: 30, borderColor: 'rgba(0,0,0,0.35)' },
});
