export interface YouTubeVideoData {
  video_id?: string;
  title?: string;
}

export interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data: number;
}

export interface YouTubePlayer {
  cuePlaylist(options: { list: string; listType: 'playlist'; index?: number }): void;
  cueVideoById(options: { videoId: string }): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  nextVideo(): void;
  previousVideo(): void;
  playVideoAt(index: number): void;
  setShuffle(shuffle: boolean): void;
  setLoop(loop: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getPlaylist(): string[];
  getPlaylistIndex(): number;
  getVideoData(): YouTubeVideoData;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

export interface YouTubePlayerApi {
  Player: new (
    container: HTMLElement,
    options: {
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: YouTubePlayerEvent) => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
        onError: (event: YouTubePlayerEvent) => void;
        onAutoplayBlocked: () => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubePlayerApi;
    onYouTubeIframeAPIReady?: () => void;
    pausePartyYouTubeApiPromise?: Promise<YouTubePlayerApi>;
  }
}
