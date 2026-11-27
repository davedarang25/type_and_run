import type { ItemQuantities, ItemRow, ItemType } from '../types/db.ts';

const ICON: Record<ItemType, string> = { ritual_salt: '◇', relic: '✝', candle: '♨', talisman: '✶' };

export function InventoryPanel({ items, session, stash, required }: {
  items: ItemRow[];
  session: ItemQuantities;
  stash: ItemQuantities;
  required: ItemQuantities;
}) {
  const ids = [...new Set([...Object.keys(required), ...Object.keys(session), ...Object.keys(stash)].map(Number))];
  return (
    <section>
      <header className="mb-2 text-[11px] uppercase tracking-[0.2em] text-dim">Ritual items</header>
      {ids.length === 0 && <p className="text-xs text-dim">Nothing yet.</p>}
      <ul className="space-y-1.5">
        {ids.map((id) => {
          const item = items.find((i) => i.item_id === id);
          if (!item) return null;
          const have = (session[id] ?? 0) + (stash[id] ?? 0);
          const need = required[id];
          const ok = need !== undefined && have >= need;
          return (
            <li key={id} className="flex items-center gap-2 text-sm" title={item.description}>
              <span className={`w-4 text-center ${ok ? 'text-ecto' : need ? 'text-candle' : 'text-dim'}`}>{ICON[item.item_type]}</span>
              <span className="flex-1 truncate">{item.item_name}</span>
              <span className={`tabular-nums text-xs ${ok ? 'text-ecto' : 'text-dim'}`}>
                {have}{need !== undefined ? ` / ${need}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
      {Object.keys(session).length > 0 && (
        <p className="mt-2 text-[11px] text-dim">Found this run: banked when you leave alive.</p>
      )}
    </section>
  );
}
