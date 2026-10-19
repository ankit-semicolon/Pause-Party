import { useEffect, useMemo, useState } from 'react';
import { YouTubePlaylistProvider } from '../services/music/YouTubePlaylistProvider';
import type { PlaybackSnapshot } from '../types/music';

export function useYouTubePlayer() {
  const provider = useMemo(() => new YouTubePlaylistProvider(), []);
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(() => provider.getSnapshot());

  useEffect(() => {
    const unsubscribe = provider.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      provider.dispose();
    };
  }, [provider]);

  return { provider, playback: snapshot };
}
