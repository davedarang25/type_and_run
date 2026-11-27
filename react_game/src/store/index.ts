import { useStore } from 'zustand';
import { createRepository } from '../repositories/index.ts';
import { createGameStore, type GameEngineState } from './gameEngine.ts';

export const repository = createRepository();
export const gameStore = createGameStore({ repo: repository });

export function useGame<T>(selector: (s: GameEngineState) => T): T {
  return useStore(gameStore, selector);
}

export * from './gameEngine.ts';
