import { useEffect, useRef, useState } from 'react';
import type { Prompt } from '../store/index.ts';
import { activeOption } from '../engine/typing.ts';
import { gameStore } from '../store/index.ts';

const KIND_LABEL: Record<Prompt['kind'], string> = {
  move: 'MOVE',
  escape: 'ESCAPE!',
  pickup: 'PICK IT UP',
  exorcise: 'CHANT',
  choice: 'DECIDE',
};

/** Bumps a key on every new typo so the shake/flash animation replays (never on mount). */
function useTypoFlash(typoAt: number) {
  const [key, setKey] = useState(0);
  const first = useRef(typoAt);
  useEffect(() => { if (typoAt !== first.current) setKey((k) => k + 1); }, [typoAt]);
  return key;
}

function Word({ word, typed, active, large }: { word: string; typed: number; active: boolean; large?: boolean }) {
  return (
    <span className={`whitespace-pre ${large ? 'text-4xl sm:text-5xl' : 'text-xl'} tracking-wide`}>
      {[...word].map((ch, i) => {
        const done = active && i < typed;
        const next = active && i === typed;
        return (
          <span
            key={i}
            className={
              done ? 'text-ecto drop-shadow-[0_0_8px_rgb(124_242_176/0.6)]'
              : next ? 'text-bone underline decoration-2 underline-offset-8 decoration-bone/70'
              : 'text-bone/35'
            }
          >
            {ch === ' ' ? ' ' : ch}
          </span>
        );
      })}
    </span>
  );
}

export function TypingPrompt({ prompt, buffer, typoAt }: { prompt: Prompt; buffer: string; typoAt: number }) {
  const flashKey = useTypoFlash(typoAt);
  const target = activeOption(buffer, prompt.options);
  const danger = prompt.kind === 'escape' || prompt.kind === 'exorcise';

  if (prompt.kind === 'choice') {
    return (
      <div key={flashKey} className={`flex flex-wrap justify-center gap-3 rounded-lg p-2 ${flashKey ? 'shake' : ''}`}>
        {prompt.choices!.map((c) => {
          const isActive = target === c.word;
          return (
            <button
              key={c.word}
              onClick={() => gameStore.getState().choose(c.action)}
              className={`group min-w-52 rounded-md border px-5 py-4 text-left transition
                ${isActive ? 'border-ecto/70 bg-ecto/5' : 'border-bone/15 bg-ash/80 hover:border-bone/40'}`}
            >
              <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-dim">{c.label}</div>
              <Word word={c.word} typed={isActive ? buffer.length : 0} active={isActive} />
            </button>
          );
        })}
      </div>
    );
  }

  const word = prompt.options[0];
  return (
    <div key={flashKey} className={`rounded-lg px-6 py-4 text-center ${flashKey ? 'shake typo-flash' : ''}`}>
      <div className={`mb-3 text-xs font-bold tracking-[0.35em] ${danger ? 'text-blood' : 'text-dim'}`}>
        {KIND_LABEL[prompt.kind]}
      </div>
      <Word word={word} typed={buffer.length} active large />
    </div>
  );
}
