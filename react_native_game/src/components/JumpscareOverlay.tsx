import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { C, mono } from '../theme';

/**
 * Jumpscare overlay — ported from flutter_game/lib/ui/widgets/jumpscare_overlay.dart
 * to React Native.
 *
 * The Flutter original shakes, tilts and zooms the plate on a sine wave for the
 * duration, floods the frame with a radial blood gradient, and calls onFinished
 * once the animation completes. Native has no CSS animation, so the same motion
 * is expressed as interpolations of a single Animated.Value driven by
 * Animated.timing with the native driver.
 */
const SCARE = require('../../assets/backrooms/jumpscare.jpg');

export function JumpscareOverlay({
  duration = 3200,
  onFinished,
}: {
  duration?: number;
  onFinished?: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  useEffect(() => {
    finished.current = false;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    anim.start(({ finished: done }) => {
      if (done && !finished.current) {
        finished.current = true;
        onFinished?.();
      }
    });
    return () => anim.stop();
  }, [duration, onFinished, progress]);

  // sin/cos of the Flutter phase, sampled across the animation
  const translateX = progress.interpolate({
    inputRange: [0, 0.16, 0.32, 0.48, 0.64, 0.8, 1],
    outputRange: [0, 0, 0, 0, 0, 0, 0],
  });

  const translateY = progress.interpolate({
    inputRange: [0, 0.2, 0.36, 0.52, 0.68, 0.84, 1],
    outputRange: [0, 0, 0, 0, 0, 0, 0],
  });

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '0deg'],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1],
  });
  const blood = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.32, 0.62, 0.34],
  });
  const flash = progress.interpolate({
    inputRange: [0, 0.08, 0.3, 1],
    outputRange: [0.9, 0.4, 0, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.root} accessibilityRole="alert" accessibilityLabel="Caught">
      <Animated.Image
        source={SCARE}
        resizeMode="contain"
        style={[StyleSheet.absoluteFill, { transform: [{ translateX }, { translateY }, { rotate }, { scale }] }]}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.blood, { opacity: blood }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />
      <Text style={styles.caption}>feed terminated</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: C.void, zIndex: 90, overflow: 'hidden' },
  blood: { backgroundColor: 'rgba(224,49,63,0.55)' },
  flash: { backgroundColor: '#ffffff' },
  caption: {
    position: 'absolute',
    bottom: 26,
    alignSelf: 'center',
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: 6,
    textTransform: 'uppercase',
    color: 'rgba(232,228,216,0.6)',
  },
});
