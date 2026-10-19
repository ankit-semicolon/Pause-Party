import { afterEach, describe, expect, it, vi } from 'vitest';
import { YouTubePlaylistProvider, youtubePageRequirementError } from './YouTubePlaylistProvider';
import type { YouTubePlayer, YouTubePlayerApi, YouTubePlayerEvent } from '../../types/youtube';

const originalYouTube = window.YT;

afterEach(() => {
  if (originalYouTube) window.YT = originalYouTube;
  else delete window.YT;
  delete window.pausePartyYouTubeApiPromise;
});

function makePlayerApi() {
  let events: {
    onReady: (event: YouTubePlayerEvent) => void;
    onStateChange: (event: YouTubePlayerEvent) => void;
    onError: (event: YouTubePlayerEvent) => void;
    onAutoplayBlocked: () => void;
  };
  const player = {
    cuePlaylist: vi.fn(() => events.onStateChange({ target: player as unknown as YouTubePlayer, data: 5 })),
    cueVideoById: vi.fn(() => events.onStateChange({ target: player as unknown as YouTubePlayer, data: 5 })),
    playVideo: vi.fn(() => events.onStateChange({ target: player as unknown as YouTubePlayer, data: 1 })),
    pauseVideo: vi.fn(() => events.onStateChange({ target: player as unknown as YouTubePlayer, data: 2 })),
    stopVideo: vi.fn(),
    nextVideo: vi.fn(),
    previousVideo: vi.fn(),
    playVideoAt: vi.fn(),
    setShuffle: vi.fn(),
    setLoop: vi.fn(),
    setVolume: vi.fn(),
    getVolume: () => 78,
    getCurrentTime: () => 12,
    getDuration: () => 120,
    getPlaylist: () => ['videoabcdefgh'],
    getPlaylistIndex: () => 0,
    getVideoData: () => ({ video_id: 'videoabcdefgh', title: 'Tiny Dance Party' }),
    getIframe: () => document.createElement('iframe'),
    destroy: vi.fn(),
  } satisfies YouTubePlayer;

  const Player = vi.fn(function (_container: HTMLElement, options: { events: typeof events }) {
    events = options.events;
    queueMicrotask(() => events.onReady({ target: player, data: -1 }));
    return player;
  });
  window.YT = {
    Player,
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  } as unknown as YouTubePlayerApi;
  return { player, Player };
}

describe('YouTubePlaylistProvider', () => {
  it('explains that YouTube needs an HTTP or HTTPS page identity', () => {
    expect(youtubePageRequirementError('file:')).toMatch(/opened directly as an HTML file/i);
    expect(youtubePageRequirementError('https:')).toBeNull();
    expect(youtubePageRequirementError('http:')).toBeNull();
    expect(youtubePageRequirementError('data:')).toMatch(/HTTP or HTTPS/i);
  });

  it('cues a playlist without playing, and only starts or pauses on direct controls', async () => {
    const { player, Player } = makePlayerApi();
    const provider = new YouTubePlaylistProvider();
    const container = document.createElement('div');
    provider.mount(container);

    await provider.loadYouTubePlaylist('PLabcdefghij');
    expect(Player).toHaveBeenCalledOnce();
    expect(player.setVolume).toHaveBeenCalledWith(89);
    expect(player.cuePlaylist).toHaveBeenCalledWith({ list: 'PLabcdefghij', listType: 'playlist', index: 0 });
    expect(player.playVideo).not.toHaveBeenCalled();
    expect(provider.getSnapshot().status).toBe('paused');
    expect(provider.getSnapshot().currentTrack?.title).toBe('Tiny Dance Party');

    await provider.play();
    expect(provider.getSnapshot().status).toBe('playing');
    await provider.pause();
    expect(provider.getSnapshot().status).toBe('paused');
    expect(player.playVideo).toHaveBeenCalledOnce();
    expect(player.pauseVideo).toHaveBeenCalledOnce();
    provider.dispose();
  });

  it('cues and plays one YouTube song without requiring a playlist', async () => {
    const { player } = makePlayerApi();
    player.getVideoData = () => ({ video_id: 'dQw4w9WgXcQ', title: 'One song' });
    const provider = new YouTubePlaylistProvider();
    provider.mount(document.createElement('div'));

    await provider.loadYouTubeVideo('dQw4w9WgXcQ');
    expect(provider.hasLoadedMedia).toBe(true);
    expect(provider.loadedMediaType).toBe('video');
    expect(player.cueVideoById).toHaveBeenCalledWith({ videoId: 'dQw4w9WgXcQ' });
    expect(player.playVideo).not.toHaveBeenCalled();
    expect(provider.getSnapshot().currentTrack?.title).toBe('One song');
    expect(provider.getSnapshot().playlist).toBeNull();

    await provider.play();
    expect(provider.getSnapshot().status).toBe('playing');
    await provider.pause();
    expect(provider.getSnapshot().status).toBe('paused');
    provider.dispose();
  });

  it('rejects a malformed playlist ID instead of pretending it loaded', async () => {
    const provider = new YouTubePlaylistProvider();
    await expect(provider.loadYouTubePlaylist('not a playlist')).rejects.toThrow(/not valid/i);
    expect(provider.getSnapshot().playlist).toBeNull();
    provider.dispose();
  });
});
