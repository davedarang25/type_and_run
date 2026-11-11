import 'package:flutter/material.dart';

abstract final class Palette {
  static const void_ = Color(0xFF07080A);
  static const ash = Color(0xFF13151A);
  static const smoke = Color(0xFF1D2027);
  static const bone = Color(0xFFE8E4D8);
  static const dim = Color(0xFF7D7F86);
  static const blood = Color(0xFFE0313F);
  static const ecto = Color(0xFF7CF2B0);
  static const candle = Color(0xFFF4B860);
}

const monoFamily = 'monospace';
const monoFallback = ['Menlo', 'Consolas', 'Courier New', 'monospace'];
const displayFamily = 'Georgia';
const displayFallback = ['Palatino', 'Times New Roman', 'serif'];

TextStyle mono({double size = 14, Color color = Palette.bone, FontWeight? weight, double? spacing}) => TextStyle(
      fontFamily: monoFamily,
      fontFamilyFallback: monoFallback,
      fontSize: size,
      color: color,
      fontWeight: weight,
      letterSpacing: spacing,
    );

TextStyle display({double size = 40, Color color = Palette.bone}) => TextStyle(
      fontFamily: displayFamily,
      fontFamilyFallback: displayFallback,
      fontSize: size,
      fontStyle: FontStyle.italic,
      color: color,
      height: 1.05,
    );

/// Small uppercase label used for panel headers.
TextStyle label({Color color = Palette.dim}) => mono(size: 11, color: color, spacing: 2.2);

ThemeData buildTheme() => ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: Palette.void_,
      colorScheme: const ColorScheme.dark(
        surface: Palette.ash,
        primary: Palette.bone,
        error: Palette.blood,
      ),
      textTheme: ThemeData.dark().textTheme.apply(
            fontFamily: monoFamily,
            bodyColor: Palette.bone,
            displayColor: Palette.bone,
          ),
    );

final difficultyColor = <String, Color>{
  'easy': Palette.ecto,
  'medium': Palette.candle,
  'hard': Palette.blood,
};
