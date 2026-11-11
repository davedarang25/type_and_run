import { gameStore, repository, useGame } from '../store/index.ts';
import type { PlaceCard } from '../repositories/types.ts';
import { LocalRepository } from '../repositories/localRepository.ts';

const DIFF: Record<string, string> = { easy: 'text-ecto border-ecto/30', medium: 'text-candle border-candle/30', hard: 'text-blood border-blood/30' };

function Card({ card }: { card: PlaceCard }) {
  const { place, progress, unlocked } = card;
  return (
    <button
      disabled={!unlocked}
      onClick={() => gameStore.getState().selectPlace(place.place_id)}
      className={`group relative flex flex-col rounded-xl border p-5 text-left transition
        ${unlocked ? 'border-bone/15 bg-ash hover:-translate-y-0.5 hover:border-bone/40' : 'cursor-not-allowed border-bone/5 bg-ash/40 opacity-50'}`}
    >
      <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
        <span className={`rounded border px-1.5 py-0.5 ${DIFF[place.difficulty]}`}>{place.difficulty}</span>
        {progress?.ritual_completed && <span className="rounded border border-ecto/30 px-1.5 py-0.5 text-ecto">exorcised</span>}
        {progress?.exploration_completed && !progress.ritual_completed && <span className="rounded border border-bone/20 px-1.5 py-0.5 text-dim">explored</span>}
        {!unlocked && <span className="text-dim">🔒 clear the previous location</span>}
      </div>
      <h3 className="font-display text-2xl italic">{place.place_name}</h3>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-dim">{place.description}</p>
      <div className="mt-4 flex gap-5 text-xs text-dim">
        <span>Best WPM <b className="text-bone tabular-nums">{progress?.best_wpm ?? '—'}</b></span>
        <span>Best accuracy <b className="text-bone tabular-nums">{progress?.best_accuracy != null ? `${progress.best_accuracy}%` : '—'}</b></span>
      </div>
      {unlocked && <span className="absolute right-5 top-5 text-xs text-dim opacity-0 transition group-hover:opacity-100">go live →</span>}
    </button>
  );
}

export function MenuScreen() {
  const offline = repository instanceof LocalRepository ? repository : null;
  const places = useGame((s) => s.places);
  const player = useGame((s) => s.player);
  const error = useGame((s) => s.error);
  const items = useGame((s) => s.items);
  const stash = useGame((s) => s.userInventory);
  const cleared = places.filter((p) => p.progress?.exploration_completed).length;
  const exorcised = places.filter((p) => p.progress?.ritual_completed).length;
  const stashList = Object.entries(stash).map(([id, q]) => `${items.find((i) => i.item_id === Number(id))?.item_name ?? id} ×${q}`);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="mb-2 flex items-center gap-2 text-xs tracking-[0.3em] text-blood"><span className="rec h-2 w-2 rounded-full bg-blood" />REC</p>
        <h1 className="font-display text-6xl italic tracking-tight sm:text-7xl">Type-to-Run</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-dim">
          You're a paranormal streamer. Every step, every hiding spot, every word of the rite is typed.
          Typos and hesitation draw them closer. Explore and leave alive, or gather what the ritual needs and end the haunting.
        </p>
        <div className="mt-6 flex flex-wrap gap-6 text-xs text-dim">
          <span>Streamer <b className="text-bone">{player?.username}</b></span>
          <span>Locations cleared <b className="text-bone">{cleared}/{places.length}</b></span>
          <span>Exorcisms <b className="text-bone">{exorcised}</b></span>
          <span>Stash <b className="text-bone">{stashList.length ? stashList.join(', ') : 'empty'}</b></span>
        </div>
      </header>
      {error && <p className="mb-6 rounded border border-blood/40 bg-blood/10 p-3 text-sm text-blood">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {places.map((c) => <Card key={c.place.place_id} card={c} />)}
      </div>
      <footer className="mt-10 flex items-center justify-between text-[11px] text-dim">
        <span>{repository.mode === 'local' ? 'Offline mode — progress saved in this browser.' : 'Connected to Supabase.'}</span>
        {offline && (
          <button
            className="underline decoration-dotted hover:text-bone"
            onClick={() => { offline.reset(); void gameStore.getState().init(); }}
          >
            reset offline save
          </button>
        )}
      </footer>
    </div>
  );
}
