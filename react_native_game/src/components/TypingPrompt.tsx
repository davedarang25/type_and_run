import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { activeOption } from '../engine/typing';
import { gameStore, type Prompt } from '../store';
import { C, mono, T } from '../theme';

const KIND_LABEL: Record<Prompt['kind'], string> = {
  move: 'MOVE',
  escape: 'ESCAPE!',
  pickup: 'PICK IT UP',
  exorcise: 'CHANT',
  choice: 'DECIDE',
};

function Word({ word, typed, active, size, testID }: { word: string; typed: number; active: boolean; size: number; testID?: string }) {
  return (
    <Text testID={testID} style={{ fontFamily: mono, fontSize: size, letterSpacing: 1 }}>
      {[...word].map((ch, i) => (
        <Text
          key={i}
          style={
            active && i < typed
              ? { color: C.ecto }
              : active && i === typed
                ? { color: C.bone, textDecorationLine: 'underline' }
                : { color: 'rgba(232,228,216,0.35)' }
          }
        >
          {ch}
        </Text>
      ))}
    </Text>
  );
}

/** The current command with per-letter feedback; shakes and flashes red on typos. */
export function TypingPrompt({ prompt, buffer, typoAt }: { prompt: Prompt; buffer: string; typoAt: number }) {
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const firstTypo = useRef(typoAt);

  useEffect(() => {
    if (typoAt === firstTypo.current) return; // not on mount
    shake.setValue(0);
    flash.setValue(prompt.kind === 'choice' ? 0 : 1);
    Animated.parallel([
      Animated.timing(shake, { toValue: 1, duration: 350, useNativeDriver: false }),
      Animated.timing(flash, { toValue: 0, duration: 400, useNativeDriver: false }),
    ]).start();
  }, [typoAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const translateX = shake.interpolate({
    inputRange: [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1],
    outputRange: [0, -3, 6, -6, 6, -3, 0],
  });
  const backgroundColor = flash.interpolate({ inputRange: [0, 1], outputRange: ['rgba(224,49,63,0)', 'rgba(224,49,63,0.35)'] });

  if (prompt.kind === 'choice') {
    const target = activeOption(buffer, prompt.options);
    return (
      <Animated.View style={[styles.choices, { transform: [{ translateX }] }]}>
        {prompt.choices!.map((c) => {
          const isActive = target === c.word;
          return (
            <Pressable
              key={c.word}
              onPress={() => gameStore.getState().choose(c.action)}
              style={[styles.choice, isActive && styles.choiceActive]}
            >
              <Text style={T.label}>{c.label}</Text>
              <Word word={c.word} typed={isActive ? buffer.length : 0} active={isActive} size={20} />
            </Pressable>
          );
        })}
      </Animated.View>
    );
  }

  const danger = prompt.kind === 'escape' || prompt.kind === 'exorcise';
  const word = prompt.options[0];
  return (
    <Animated.View style={[styles.single, { transform: [{ translateX }], backgroundColor }]}>
      <Text style={[styles.kind, { color: danger ? C.blood : C.dim }]}>{KIND_LABEL[prompt.kind]}</Text>
      <Word testID="prompt-word" word={word} typed={buffer.length} active size={word.length > 16 ? 26 : 36} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  single: { alignItems: 'center', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  kind: { fontFamily: mono, fontSize: 12, fontWeight: 'bold', letterSpacing: 4, marginBottom: 10 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  choice: { minWidth: 150, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(19,21,26,0.85)', borderRadius: 8, padding: 14, gap: 6 },
  choiceActive: { borderColor: 'rgba(124,242,176,0.7)', backgroundColor: 'rgba(124,242,176,0.06)' },
});
