import { Platform, StyleSheet } from 'react-native';

export const C = {
  void: '#07080a',
  ash: '#13151a',
  smoke: '#1d2027',
  bone: '#e8e4d8',
  dim: '#7d7f86',
  blood: '#e0313f',
  ecto: '#7cf2b0',
  candle: '#f4b860',
  line: 'rgba(232,228,216,0.12)',
};

export const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
});

export const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: '"Iowan Old Style", Palatino, Georgia, serif',
});

export const T = StyleSheet.create({
  text: { color: C.bone, fontFamily: mono, fontSize: 14 },
  dim: { color: C.dim, fontFamily: mono, fontSize: 12 },
  label: { color: C.dim, fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  display: { color: C.bone, fontFamily: serif, fontStyle: 'italic' },
  card: { backgroundColor: C.ash, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 16 },
});

export const DIFF_COLOR: Record<string, string> = { easy: C.ecto, medium: C.candle, hard: C.blood };
