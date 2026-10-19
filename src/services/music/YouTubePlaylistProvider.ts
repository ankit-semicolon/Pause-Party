import type { MusicPlaylist, MusicProvider, MusicTrack, PlaybackSnapshot } from '../../types/music';
import type { YouTubePlayer, YouTubePlayerApi, YouTubePlayerEvent } from '../../types/youtube';
import { DEFAULT_MUSIC_VOLUME } from '../../config/musicSettings';

type SnapshotListener = (snapshot: PlaybackSnapshot) => void;
export type YouTubeMediaType = 'playlist' | 'video';

export function youtubePageRequirementError(protocol: string): string | null {
  if (protocol === 'file:') {
    return 'YouTube blocks playback when Pause Party is opened directly as an HTML file. Use the HTTPS website link, or run the app on localhost with pnpm dev. Built-in music still works from the HTML file.';
  }
  if (protocol !== 'http:' && protocol !== 'https:') {
    return 'YouTube playback needs Pause Party to be opened from a website using HTTP or HTTPS.';
  }
  return null;
}

function loadYouTubeApi(): Promise<YouTubePlayerApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (window.pausePartyYouTubeApiPromise) return window.pausePartyYouTubeApiPromise;

  const pending = new Promise<YouTubePlayerApi>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube could not initialize its embedded player.'));
    };

    let script = document.querySelector<HTMLScriptElement>('script[data-pause-party-youtube]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.pausePartyYoutube = 'true';
      script.onerror = () => reject(new Error('Could not load YouTube. Check your connection and try again.'));
      document.head.append(script);
    }
  });

  window.pausePartyYouTubeApiPromise = pending;
  void pending.catch(() => {
    if (window.pausePartyYouTubeApiPromise === pending) delete window.pausePartyYouTubeApiPromise;
  });
  return pending;
}

/** Controls YouTube only through its visible, branded IFrame player. */
export class YouTubePlaylistProvider implements MusicProvider {
  private listeners = new Set<SnapshotListener>();
  private player: YouTubePlayer | null = null;
  private container: HTMLElement | null = null;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private status: PlaybackSnapshot['status'] = 'idle';
  private error: string | null = null;
  private playlistId: string | null = null;
  private videoId: string | null = null;
  private shuffle = false;
  private repeat = true;
  private volume = DEFAULT_MUSIC_VOLUME;
  private progressTimer: ReturnType<typeof setTimeout> | null = null;
  private playTimeout: ReturnType<typeof setTimeout> | null = null;
  private cueTimeout: ReturnType<typeof setTimeout> | null = null;
  private resolvePlay: (() => void) | null = null;
  private rejectPlay: ((error: Error) => void) | null = null;
  private resolveCue: (() => void) | null = null;
  private rejectCue: ((error: Error) => void) | null = null;
  private disposed = false;

  get loadedMediaId(): string | null {
    return this.playlistId ?? this.videoId;
  }

  get loadedMediaType(): YouTubeMediaType | null {
    return this.playlistId ? 'playlist' : this.videoId ? 'video' : null;
  }

  get hasLoadedMedia(): boolean {
    return this.loadedMediaId !== null;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.disposed = false;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    if (this.player) return;
    const pageError = youtubePageRequirementError(window.location.protocol);
    if (pageError) {
      this.fail(pageError);
      return;
    }
    if (!this.readyPromise) {
      this.readyPromise = new Promise<void>((resolve) => { this.resolveReady = resolve; });
    }

    void loadYouTubeApi().then((api) => {
      if (!this.container || this.player || this.disposed) return;
      this.status = 'loading';
      this.publish();
      const currentContainer = this.container;
      this.player = new api.Player(currentContainer, {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: this.onReady,
          onStateChange: (event) => this.onStateChange(event, api),
          onError: this.onError,
          onAutoplayBlocked: this.onAutoplayBlocked,
        },
      });
    }).catch((cause: unknown) => {
      this.resolveReady?.();
      this.resolveReady = null;
      this.fail(cause instanceof Error ? cause.message : 'YouTube could not load.');
    });
  }

  unmount(): void {
    this.container = null;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.cancelProgressPolling();
    this.clearPlayTimeout();
    this.clearCueTimeout();
    const player = this.player;
    this.player = null;
    this.resolveReady?.();
    this.resolveReady = null;
    this.readyPromise = null;
    this.resolveReady = null;
    this.disposed = true;
    player?.destroy();
  }

  getSnapshot(): PlaybackSnapshot {
    const player = this.player;
    const video = this.safe(() => player?.getVideoData()) ?? {};
    const videoIds = this.safe(() => player?.getPlaylist()) ?? [];
    const index = Math.max(0, this.safe(() => player?.getPlaylistIndex()) ?? 0);
    const playlist = this.playlistId ? this.makePlaylist(videoIds) : null;
    const videoId = video.video_id || videoIds[index] || this.videoId || '';
    const currentTrack: MusicTrack | null = videoId ? {
      id: videoId,
      title: video.title || 'YouTube video',
      artist: this.playlistId ? 'YouTube playlist' : 'YouTube video',
      audioUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      category: 'YouTube video',
    } : null;
    const currentTime = this.safe(() => player?.getCurrentTime()) ?? 0;
    const duration = this.safe(() => player?.getDuration()) ?? 0;

    return {
      status: this.status,
      currentTime: Number.isFinite(currentTime) ? currentTime : 0,
      duration: Number.isFinite(duration) && duration > 0 ? duration : null,
      currentTrack,
      playlist,
      trackIndex: index,
      error: this.error,
    };
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  loadPlaylist(playlist: MusicPlaylist): void {
    const id = playlist.id.startsWith('youtube:') ? playlist.id.slice('youtube:'.length) : playlist.id;
    void this.loadYouTubePlaylist(id).catch(() => undefined);
  }

  async loadYouTubePlaylist(playlistId: string): Promise<void> {
    if (!/^[a-zA-Z0-9_-]{10,80}$/.test(playlistId)) {
      throw new Error('That YouTube playlist ID is not valid. Paste a YouTube or YouTube Music playlist link.');
    }
    await this.cueMedia('playlist', playlistId);
  }

  async loadYouTubeVideo(videoId: string): Promise<void> {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      throw new Error('That YouTube video ID is not valid. Paste a YouTube song or video link.');
    }
    await this.cueMedia('video', videoId);
  }

  private async cueMedia(type: YouTubeMediaType, id: string): Promise<void> {
    const pageError = youtubePageRequirementError(window.location.protocol);
    if (pageError) throw new Error(pageError);
    if (!this.player) {
      if (!this.container || !this.readyPromise) {
        throw new Error('Show the YouTube player before loading a song or playlist.');
      }
      await this.readyPromise;
    }
    if (!this.player) throw new Error('The YouTube player is not ready yet. Try loading the song or playlist again.');

    this.clearPlayTimeout();
    this.clearCueTimeout();
    this.rejectCue?.(new Error('A different YouTube item was loaded before this one finished.'));
    this.resolveCue = null;
    this.rejectCue = null;
    this.playlistId = type === 'playlist' ? id : null;
    this.videoId = type === 'video' ? id : null;
    this.status = 'loading';
    this.error = null;
    this.publish();

    await new Promise<void>((resolve, reject) => {
      this.resolveCue = resolve;
      this.rejectCue = reject;
      this.cueTimeout = setTimeout(() => {
        this.clearCueTimeout();
        this.resolveCue = null;
        this.rejectCue = null;
        reject(new Error(`YouTube did not load that ${type === 'playlist' ? 'playlist' : 'song'}. Check that it is available and try again.`));
      }, 15000);
      try {
        if (type === 'playlist') this.player?.cuePlaylist({ list: id, listType: 'playlist', index: 0 });
        else this.player?.cueVideoById({ videoId: id });
      } catch {
        this.fail(`YouTube could not load this ${type === 'playlist' ? 'playlist' : 'video'}. Check the link and try again.`);
      }
    });
  }

  selectTrack(trackId: string): void {
    const index = this.safe(() => this.player?.getPlaylist().indexOf(trackId)) ?? -1;
    if (index >= 0) this.player?.playVideoAt?.(index);
  }

  async play(): Promise<void> {
    if (!this.player || !this.hasLoadedMedia || !this.readyPromise) {
      throw new Error('Load a YouTube song or playlist before starting the game.');
    }
    if (this.status === 'playing') return;
    await this.readyPromise;
    this.status = 'loading';
    this.error = null;
    this.publish();

    await new Promise<void>((resolve, reject) => {
      this.resolvePlay = resolve;
      this.rejectPlay = reject;
      this.playTimeout = setTimeout(() => {
        this.clearPlayTimeout();
        this.resolvePlay = null;
        this.rejectPlay = null;
        this.fail('YouTube playback did not start. Press Start again or use the controls in the YouTube player.');
        reject(new Error(this.error ?? 'YouTube playback did not start.'));
      }, 10000);
      this.player?.playVideo();
    });
  }

  async pause(): Promise<void> {
    this.clearPlayTimeout();
    this.resolvePlay = null;
    this.rejectPlay = null;
    this.player?.pauseVideo();
    this.cancelProgressPolling();
    if (this.status !== 'error' && this.status !== 'ended') this.status = 'paused';
    this.publish();
  }

  next(): void { if (this.playlistId) this.player?.nextVideo(); }
  previous(): void { if (this.playlistId) this.player?.previousVideo(); }

  setShuffle(enabled: boolean): void {
    this.shuffle = enabled;
    if (this.playlistId) this.player?.setShuffle(enabled);
    this.publish();
  }

  setRepeat(enabled: boolean): void {
    this.repeat = enabled;
    if (this.playlistId) this.player?.setLoop(enabled);
    this.publish();
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.player?.setVolume(Math.round(this.volume * 100));
    this.publish();
  }

  dispose(): void {
    this.unmount();
    this.listeners.clear();
  }

  private makePlaylist(videoIds: string[]): MusicPlaylist {
    const index = Math.max(0, this.safe(() => this.player?.getPlaylistIndex()) ?? 0);
    const current = this.safe(() => this.player?.getVideoData()) ?? {};
    return {
      id: `youtube:${this.playlistId}`,
      name: 'YouTube playlist',
      description: 'Played in YouTube’s visible video player.',
      tracks: videoIds.map((id, trackIndex) => ({
        id,
        title: trackIndex === index ? current.title || `Video ${trackIndex + 1}` : `Video ${trackIndex + 1}`,
        audioUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
      })),
    };
  }

  private onReady = (): void => {
    this.safe(() => this.player?.getIframe().setAttribute('title', 'YouTube song or playlist player'));
    this.player?.setVolume(Math.round(this.volume * 100));
    if (this.playlistId) {
      this.player?.setShuffle(this.shuffle);
      this.player?.setLoop(this.repeat);
    }
    this.status = this.hasLoadedMedia ? 'loading' : 'idle';
    this.resolveReady?.();
    this.resolveReady = null;
    this.publish();
  };

  private onStateChange = (event: YouTubePlayerEvent, api: YouTubePlayerApi): void => {
    switch (event.data) {
      case api.PlayerState.PLAYING:
        this.status = 'playing';
        this.error = null;
        this.clearPlayTimeout();
        this.resolvePlay?.();
        this.resolvePlay = null;
        this.rejectPlay = null;
        this.startProgressPolling();
        break;
      case api.PlayerState.BUFFERING:
        this.status = 'loading';
        this.cancelProgressPolling();
        break;
      case api.PlayerState.PAUSED:
        this.status = 'paused';
        this.cancelProgressPolling();
        break;
      case api.PlayerState.CUED:
        this.status = 'paused';
        if (this.playlistId) {
          this.player?.setShuffle(this.shuffle);
          this.player?.setLoop(this.repeat);
        }
        this.clearCueTimeout();
        this.resolveCue?.();
        this.resolveCue = null;
        this.rejectCue = null;
        break;
      case api.PlayerState.ENDED:
        this.status = 'ended';
        this.cancelProgressPolling();
        break;
      default:
        break;
    }
    this.publish();
  };

  private onError = (event: YouTubePlayerEvent): void => {
    const detail = event.data === 100 || event.data === 101 || event.data === 150
      ? 'This video is unavailable or does not allow embedded playback.'
      : event.data === 153
        ? 'YouTube could not identify this page (Error 153). Open Pause Party from its HTTPS website or localhost URL, not a saved HTML file, and make sure your browser allows referrer information.'
        : `YouTube reported a player error (${event.data}). Check the playlist and try another one.`;
    this.fail(detail);
  };

  private onAutoplayBlocked = (): void => {
    this.fail('Your browser blocked YouTube playback. Tap Start again, or press Play in the visible YouTube player.');
  };

  private onVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible' && this.status === 'playing') void this.pause();
  };

  private fail(message: string): void {
    this.status = 'error';
    this.error = message;
    this.cancelProgressPolling();
    this.clearPlayTimeout();
    this.clearCueTimeout();
    const error = new Error(message);
    this.rejectPlay?.(error);
    this.rejectCue?.(error);
    this.resolvePlay = null;
    this.rejectPlay = null;
    this.resolveCue = null;
    this.rejectCue = null;
    this.publish();
  }

  private startProgressPolling(): void {
    if (this.progressTimer) return;
    const update = () => {
      if (this.status !== 'playing' || !this.player) return;
      this.publish();
      this.progressTimer = setTimeout(update, 250);
    };
    this.progressTimer = setTimeout(update, 250);
  }

  private cancelProgressPolling(): void {
    if (this.progressTimer) clearTimeout(this.progressTimer);
    this.progressTimer = null;
  }

  private clearPlayTimeout(): void {
    if (this.playTimeout) clearTimeout(this.playTimeout);
    this.playTimeout = null;
  }

  private clearCueTimeout(): void {
    if (this.cueTimeout) clearTimeout(this.cueTimeout);
    this.cueTimeout = null;
  }

  private publish(): void {
    if (this.disposed) return;
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private safe<T>(read: () => T | undefined): T | undefined {
    try { return read(); } catch { return undefined; }
  }
}
