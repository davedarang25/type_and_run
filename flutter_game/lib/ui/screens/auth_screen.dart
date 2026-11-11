// Only shown when Supabase is configured and nobody is signed in.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../state/game_engine.dart';
import '../theme.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});
  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  bool _signUp = false;
  bool _busy = false;
  String? _msg;
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _username = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _username.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _msg = null;
    });
    final auth = Supabase.instance.client.auth;
    try {
      if (_signUp) {
        final res = await auth.signUp(
          email: _email.text.trim(),
          password: _password.text,
          data: {'username': _username.text.trim()},
        );
        if (res.session == null) {
          setState(() => _msg = 'Check your email to confirm your account, then sign in.');
          return;
        }
      } else {
        await auth.signInWithPassword(email: _email.text.trim(), password: _password.text);
      }
      await ref.read(gameEngineProvider.notifier).init();
    } on AuthException catch (e) {
      setState(() => _msg = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  InputDecoration _deco(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: mono(size: 13, color: Palette.dim),
        filled: true,
        fillColor: Palette.ash,
        border: OutlineInputBorder(borderSide: BorderSide(color: Palette.bone.withValues(alpha: 0.15))),
        enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: Palette.bone.withValues(alpha: 0.15))),
      );

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Type-to-Run', style: display(size: 48)),
            const SizedBox(height: 32),
            if (_signUp) ...[
              TextField(controller: _username, decoration: _deco('Streamer name'), style: mono()),
              const SizedBox(height: 12),
            ],
            TextField(controller: _email, decoration: _deco('Email'), style: mono(), keyboardType: TextInputType.emailAddress),
            const SizedBox(height: 12),
            TextField(controller: _password, decoration: _deco('Password'), style: mono(), obscureText: true, onSubmitted: (_) => _submit()),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _submit,
              style: FilledButton.styleFrom(backgroundColor: Palette.bone, foregroundColor: Palette.void_),
              child: Text(_signUp ? 'Create account' : 'Sign in', style: mono(color: Palette.void_, weight: FontWeight.bold)),
            ),
            if (_msg != null) ...[
              const SizedBox(height: 12),
              Text(_msg!, style: mono(size: 12, color: Palette.candle)),
            ],
            TextButton(
              onPressed: () => setState(() => _signUp = !_signUp),
              child: Text(_signUp ? 'Have an account? Sign in' : 'New streamer? Create an account', style: mono(size: 12, color: Palette.dim)),
            ),
          ]),
        ),
      ),
    );
  }
}
