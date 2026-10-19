export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  audioUrl: string;
  duration?: number;
  coverImage?: string;
  category?: string;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  tracks: MusicTrack[];
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface PlaybackSnapshot {
  status: PlaybackStatus;
  currentTime: number;
  duration: number | null;
  currentTrack: MusicTrack | null;
  playlist: MusicPlaylist | null;
  trackIndex: number;
  error: string | null;
}

export interface MusicProvider {
  getSnapshot(): PlaybackSnapshot;
  subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void;
  loadPlaylist(playlist: MusicPlaylist): void;
  selectTrack(trackId: string): void;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): void;
  previous(): void;
  setShuffle(enabled: boolean): void;
  setRepeat(enabled: boolean): void;
  setVolume(value: number): void;
  dispose(): void;
}
