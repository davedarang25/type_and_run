// Only shown when Supabase is configured and nobody is signed in.
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase.ts';
import { gameStore } from '../store/index.ts';

export function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    const res = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { username } } });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === 'up' && !res.data.session) return setMsg('Check your email to confirm your account, then sign in.');
    await gameStore.getState().init();
  }

  const input = 'w-full rounded border border-bone/15 bg-ash px-3 py-2 text-sm outline-none focus:border-bone/50';
  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-6">
      <h1 className="font-display text-5xl italic">Type-to-Run</h1>
      <form onSubmit={submit} className="mt-8 space-y-3">
        {mode === 'up' && <input className={input} placeholder="Streamer name" value={username} onChange={(e) => setUsername(e.target.value)} required />}
        <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <button disabled={busy} className="w-full rounded bg-bone py-2 text-sm font-bold text-void disabled:opacity-50">
          {mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        {msg && <p className="text-xs text-candle">{msg}</p>}
      </form>
      <button className="mt-4 text-xs text-dim underline decoration-dotted" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'New streamer? Create an account' : 'Have an account? Sign in'}
      </button>
    </div>
  );
}
