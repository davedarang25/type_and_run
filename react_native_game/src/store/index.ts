import { useStore } from 'zustand';
import { createRepository } from '../repositories';
import { createGameStore, type GameEngineState, type Phase } from './gameEngine';

export const repository = createRepository();
export const gameStore = createGameStore({ repo: repository });

export function useGame<T>(selector: (s: GameEngineState) => T): T {
  return useStore(gameStore, selector);
}

export const TYPING_PHASES = new Set<Phase>(['exploring', 'decision', 'ritualPrompt', 'insufficient', 'exorcism', 'results', 'gameover']);

export * from './gameEngine';
