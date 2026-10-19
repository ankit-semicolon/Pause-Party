import { useEffect, useMemo, useState } from 'react';
import { BuiltInMusicProvider } from '../services/music/BuiltInMusicProvider';
import type { PlaybackSnapshot } from '../types/music';

export function useMusicPlayer() {
  const provider = useMemo(() => new BuiltInMusicProvider(new Audio()), []);
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(() => provider.getSnapshot());

  useEffect(() => {
    const unsubscribe = provider.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      void provider.pause();
    };
  }, [provider]);

  return { provider, playback: snapshot };
}
