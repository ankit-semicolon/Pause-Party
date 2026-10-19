import { useEffect, useMemo, useState } from 'react';
import { GameEngine } from '../services/game/GameEngine';
import type { PauseBounds } from '../types/game';
import type { MusicProvider } from '../types/music';
import { normalizeBounds } from '../utils/randomInterval';

export function useGameEngine(provider: MusicProvider, bounds: PauseBounds) {
  const engine = useMemo(() => new GameEngine(provider, bounds), [provider]);
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());
  const normalized = normalizeBounds(bounds);

  useEffect(() => {
    engine.activate();
    const unsubscribe = engine.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      engine.deactivate();
    };
  }, [engine]);

  useEffect(() => engine.updateBounds(normalized), [engine, normalized.minSeconds, normalized.maxSeconds]);

  return { engine, game: snapshot };
}
