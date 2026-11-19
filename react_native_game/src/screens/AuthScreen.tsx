// Sign-in / sign-up against POST /api/users/login|register.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiBaseUrl } from '../lib/api';
import { ApiRepository } from '../repositories/apiRepository';
import { gameStore, repository } from '../store';
import { C, mono, T } from '../theme';

export function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!(repository instanceof ApiRepository)) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'in') await repository.login(email.trim(), password);
      else await repository.register(username.trim(), email.trim(), password);
      await gameStore.getState().init();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = { placeholderTextColor: C.dim, style: styles.input, autoCapitalize: 'none' as const, autoCorrect: false };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={styles.box}>
        <Text style={[T.display, { fontSize: 44 }]}>Type-to-Run</Text>
        {mode === 'up' && <TextInput {...field} placeholder="Streamer name" value={username} onChangeText={setUsername} />}
        <TextInput {...field} placeholder="Email" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput {...field} placeholder="Password (6+ characters)" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        <Pressable disabled={busy} onPress={submit} style={[styles.button, busy && { opacity: 0.5 }]}>
          <Text style={styles.buttonText}>{mode === 'in' ? 'Sign in' : 'Create account'}</Text>
        </Pressable>
        {msg && <Text style={[T.dim, { color: C.candle }]}>{msg}</Text>}
        <Pressable onPress={() => setMode(mode === 'in' ? 'up' : 'in')}>
          <Text style={[T.dim, { textAlign: 'center', textDecorationLine: 'underline' }]}>
            {mode === 'in' ? 'New streamer? Create an account' : 'Have an account? Sign in'}
          </Text>
        </Pressable>
        <Text style={[T.dim, { fontSize: 10, textAlign: 'center' }]}>Server: {apiBaseUrl}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 380, alignSelf: 'center', gap: 12 },
  input: { borderWidth: 1, borderColor: C.line, backgroundColor: C.ash, color: C.bone, fontFamily: mono, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  button: { backgroundColor: C.bone, borderRadius: 6, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: C.void, fontFamily: mono, fontWeight: 'bold', fontSize: 15 },
});
