import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initStorage } from './src/lib/storage';
import { gameStore, useGame } from './src/store';
import { TypingCapture } from './src/components/TypingCapture';
import { JumpscareOverlay } from './src/components/JumpscareOverlay';
import { AuthScreen } from './src/screens/AuthScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { RunScreen } from './src/screens/RunScreen';
import { C, T } from './src/theme';

function Screen() {
  const phase = useGame((s) => s.phase);
  switch (phase) {
    case 'boot':
    case 'loading':
      return (
        <View style={styles.center}>
          <ActivityIndicator color={C.dim} />
          <Text style={[T.label, { marginTop: 12 }]}>Connecting to stream…</Text>
        </View>
      );
    case 'auth':
      return <AuthScreen />;
    case 'menu':
      return <MenuScreen />;
    case 'results':
    case 'gameover':
      return <ResultsScreen />;
    default:
      return <RunScreen />;
  }
}

/** Fires the jumpscare the moment the player is caught (ported from the Flutter build). */
function CaughtScare() {
  const phase = useGame((s) => s.phase);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(phase === 'gameover');
  }, [phase]);

  if (!visible) return null;
  return <JumpscareOverlay onFinished={() => setVisible(false)} />;
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initStorage().then(() => {
      setReady(true);
      void gameStore.getState().init();
    });
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        {/* Mounted once for the whole app so keyboard input survives screen changes between runs. */}
        {ready && <TypingCapture />}
        <Screen />
        <CaughtScare />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
