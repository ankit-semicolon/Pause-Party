import { useEffect, useRef } from 'react';
import type { YouTubePlaylistProvider } from '../services/music/YouTubePlaylistProvider';

export function YouTubePlayerSurface({ provider }: { provider: YouTubePlaylistProvider }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current) provider.mount(container.current);
    return () => provider.unmount();
  }, [provider]);

  return <div className="youtube-player-frame" ref={container} aria-label="Visible YouTube playlist player" />;
}
