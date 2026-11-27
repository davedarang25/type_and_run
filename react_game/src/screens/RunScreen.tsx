import { useMemo } from 'react';
import { useGame } from '../store/index.ts';
import { repository } from '../store/index.ts';
import { requiredItems, ritualTargets } from '../engine/ritual.ts';
import { lurkingGhost, STEPS_PER_ROOM } from '../engine/ghostAI.ts';
import { CameraFeed } from '../components/CameraFeed.tsx';
import { EventLog } from '../components/EventLog.tsx';
import { GhostMeter } from '../components/GhostMeter.tsx';
import { InventoryPanel } from '../components/InventoryPanel.tsx';
import { StreamHeader } from '../components/StreamHeader.tsx';
import { TimerBar } from '../components/TimerBar.tsx';
import { TypingPrompt } from '../components/TypingPrompt.tsx';

const PHASE_TEXT: Partial<Record<string, string>> = {
  decision: 'The room is clear. Push deeper for more items — or wrap up the stream?',
  ritualPrompt: 'Attempt the exorcism, or save the footage and go home?',
  insufficient: 'The ritual is incomplete. You need more items.',
  saving: 'Uploading footage…',
};

export function RunScreen() {
  const s = useGame((st) => st);
  const content = s.content!;
  const required = useMemo(() => requiredItems(content), [content]);
  const boss = ritualTargets(content)[0];
  const chaseGhost = s.chase ? content.ghosts.find((g) => g.ghost_id === s.chase!.ghostId) ?? null : null;
  const threat = chaseGhost ?? (s.phase === 'exorcism' ? boss : lurkingGhost(content.ghosts));
  const itemsFound = Object.values(s.sessionInventory).reduce((a, b) => a + b, 0);
  const viewers = 24 + s.playerDistance * 9 + s.chasesSurvived * 70 + itemsFound * 18 + Math.round(s.ghostProximity * 2.2);

  return (
    <div className="mx-auto grid min-h-full max-w-6xl gap-5 px-5 py-6 lg:grid-cols-[1fr_300px]">
      <main className="flex flex-col gap-4">
        <StreamHeader title={content.place.place_name} viewers={viewers} startedAt={s.sessionStartedAt} mode={repository.mode} />
        <CameraFeed proximity={s.ghostProximity} chasing={!!s.chase || s.phase === 'exorcism'} atmosphere={content.place.atmosphere}>
          <div className="flex min-h-[480px] flex-col justify-between p-6">
            <div className="flex justify-between text-[11px] uppercase tracking-[0.2em] text-dim">
              <span>Room {s.room + 1} · step {Math.min(s.stepInRoom + 1, STEPS_PER_ROOM)}/{STEPS_PER_ROOM}</span>
              <span>{s.playerDistance} steps in</span>
            </div>

            <div className="flex flex-col items-center gap-5">
              {s.chase && chaseGhost && (
                <p className="text-sm font-bold tracking-[0.25em] text-blood">
                  {chaseGhost.ghost_name.toUpperCase()} — {s.chase.escapesDone}/{s.chase.escapesNeeded} TO LOSE IT
                </p>
              )}
              {s.exorcism && (
                <p className="text-sm font-bold tracking-[0.25em] text-candle">
                  RITE OF BANISHMENT — {s.exorcism.done}/{s.exorcism.needed}
                </p>
              )}
              {PHASE_TEXT[s.phase] && <p className="max-w-md text-center text-sm text-bone/80">{PHASE_TEXT[s.phase]}</p>}
              {s.phase === 'insufficient' && (
                <ul className="text-sm text-candle">
                  {s.missing.map((m) => (
                    <li key={m.item_id}>{content.items.find((i) => i.item_id === m.item_id)?.item_name}: {m.have}/{m.needed}</li>
                  ))}
                </ul>
              )}
              {s.prompt && <TypingPrompt prompt={s.prompt} buffer={s.buffer} typoAt={s.typoAt} />}
              {s.prompt && <TimerBar prompt={s.prompt} />}
            </div>

            <p className="text-center text-[11px] text-dim">
              {s.prompt?.kind === 'choice' ? 'Type an option (or click it).' : 'Just type. Mistakes cost time and bring them closer.'}
            </p>
          </div>
        </CameraFeed>
      </main>

      <aside className="flex flex-col gap-6 rounded-xl border border-bone/10 bg-ash/60 p-5">
        <GhostMeter proximity={s.ghostProximity} ghost={threat} chasing={!!s.chase || s.phase === 'exorcism'} />
        <section className="text-xs text-dim">
          <header className="mb-2 text-[11px] uppercase tracking-[0.2em]">Target</header>
          <p className="text-sm text-bone">{boss?.ghost_name}</p>
          <p className="mt-1 leading-relaxed">{boss?.description}</p>
          <p className="mt-1">Weakness: <span className="text-candle">{boss?.weakness}</span></p>
        </section>
        <InventoryPanel items={content.items} session={s.sessionInventory} stash={s.userInventory} required={required} />
        <EventLog log={s.log} />
      </aside>
    </div>
  );
}
