import type { MusicPlaylist, MusicProvider, PlaybackSnapshot, MusicTrack } from '../../types/music';
import { DEFAULT_MUSIC_VOLUME } from '../../config/musicSettings';

type SnapshotListener = (snapshot: PlaybackSnapshot) => void;

/** HTML5 audio provider. It never calls play except through an explicit play(). */
export class BuiltInMusicProvider implements MusicProvider {
  private readonly audio: HTMLAudioElement;
  private listeners = new Set<SnapshotListener>();
  private playlist: MusicPlaylist | null = null;
  private trackIndex = 0;
  private status: PlaybackSnapshot['status'] = 'idle';
  private error: string | null = null;
  private shuffle = false;
  private repeat = true;
  private shuffleOrder: number[] = [];
  private disposed = false;

  constructor(audio: HTMLAudioElement = new Audio()) {
    this.audio = audio;
    this.audio.volume = DEFAULT_MUSIC_VOLUME;
    this.audio.preload = 'metadata';
    this.audio.addEventListener('loadstart', this.onLoadStart);
    this.audio.addEventListener('loadedmetadata', this.onMetadata);
    this.audio.addEventListener('timeupdate', this.onTimeUpdate);
    this.audio.addEventListener('playing', this.onPlaying);
    this.audio.addEventListener('pause', this.onPause);
    this.audio.addEventListener('ended', this.onEnded);
    this.audio.addEventListener('error', this.onError);
    this.audio.addEventListener('waiting', this.onWaiting);
    this.audio.addEventListener('canplay', this.onCanPlay);
  }

  getSnapshot(): PlaybackSnapshot {
    return {
      status: this.status,
      currentTime: Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : null,
      currentTrack: this.currentTrack,
      playlist: this.playlist,
      trackIndex: this.trackIndex,
      error: this.error,
    };
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  loadPlaylist(playlist: MusicPlaylist): void {
    if (!playlist.tracks.length) throw new Error('This playlist has no tracks yet.');
    this.audio.pause();
    this.playlist = playlist;
    this.trackIndex = 0;
    this.shuffleOrder = playlist.tracks.map((_, index) => index);
    this.status = 'paused';
    this.error = null;
    this.loadCurrentTrack();
  }

  selectTrack(trackId: string): void {
    if (!this.playlist) return;
    const nextIndex = this.playlist.tracks.findIndex((track) => track.id === trackId);
    if (nextIndex < 0 || nextIndex === this.trackIndex) return;
    this.audio.pause();
    this.trackIndex = nextIndex;
    this.status = 'paused';
    this.error = null;
    this.loadCurrentTrack();
  }

  async play(): Promise<void> {
    if (!this.currentTrack) throw new Error('Choose a playlist before starting the game.');
    if (this.disposed) throw new Error('The music player is no longer available.');
    this.error = null;
    try {
      await this.audio.play();
      this.status = 'playing';
      this.publish();
    } catch (cause) {
      this.status = 'error';
      this.error = cause instanceof Error
        ? 'The browser could not start this audio. Check the file and press Start again.'
        : 'Audio playback was blocked. Tap Start to try again.';
      this.publish();
      throw new Error(this.error);
    }
  }

  async pause(): Promise<void> {
    this.audio.pause();
    if (this.status !== 'ended' && this.status !== 'error') this.status = 'paused';
    this.publish();
  }

  next(): void {
    if (!this.playlist?.tracks.length) return;
    if (this.shuffle && this.shuffleOrder.length > 1) {
      const currentPosition = this.shuffleOrder.indexOf(this.trackIndex);
      this.trackIndex = this.shuffleOrder[(currentPosition + 1) % this.shuffleOrder.length]!;
    } else {
      this.trackIndex = (this.trackIndex + 1) % this.playlist.tracks.length;
    }
    this.audio.pause();
    this.status = 'paused';
    this.error = null;
    this.loadCurrentTrack();
  }

  previous(): void {
    if (!this.playlist?.tracks.length) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      this.publish();
      return;
    }
    if (this.shuffle && this.shuffleOrder.length > 1) {
      const currentPosition = this.shuffleOrder.indexOf(this.trackIndex);
      this.trackIndex = this.shuffleOrder[(currentPosition - 1 + this.shuffleOrder.length) % this.shuffleOrder.length]!;
    } else {
      this.trackIndex = (this.trackIndex - 1 + this.playlist.tracks.length) % this.playlist.tracks.length;
    }
    this.audio.pause();
    this.status = 'paused';
    this.error = null;
    this.loadCurrentTrack();
  }

  setShuffle(enabled: boolean): void {
    this.shuffle = enabled;
    if (enabled && this.playlist) {
      this.shuffleOrder = this.playlist.tracks.map((_, index) => index);
      for (let index = this.shuffleOrder.length - 1; index > 0; index -= 1) {
        const swapAt = Math.floor(Math.random() * (index + 1));
        [this.shuffleOrder[index], this.shuffleOrder[swapAt]] = [this.shuffleOrder[swapAt]!, this.shuffleOrder[index]!];
      }
      const currentOrder = this.shuffleOrder.indexOf(this.trackIndex);
      [this.shuffleOrder[0], this.shuffleOrder[currentOrder]] = [this.shuffleOrder[currentOrder]!, this.shuffleOrder[0]!];
    }
    this.publish();
  }

  setRepeat(enabled: boolean): void {
    this.repeat = enabled;
    this.audio.loop = enabled && (this.playlist?.tracks.length ?? 0) === 1;
    this.publish();
  }

  setVolume(value: number): void {
    this.audio.volume = Math.max(0, Math.min(1, value));
    this.publish();
  }

  dispose(): void {
    this.disposed = true;
    this.audio.pause();
    this.audio.removeEventListener('loadstart', this.onLoadStart);
    this.audio.removeEventListener('loadedmetadata', this.onMetadata);
    this.audio.removeEventListener('timeupdate', this.onTimeUpdate);
    this.audio.removeEventListener('playing', this.onPlaying);
    this.audio.removeEventListener('pause', this.onPause);
    this.audio.removeEventListener('ended', this.onEnded);
    this.audio.removeEventListener('error', this.onError);
    this.audio.removeEventListener('waiting', this.onWaiting);
    this.audio.removeEventListener('canplay', this.onCanPlay);
    this.listeners.clear();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  private get currentTrack(): MusicTrack | null {
    return this.playlist?.tracks[this.trackIndex] ?? null;
  }

  private loadCurrentTrack(): void {
    const track = this.currentTrack;
    if (!track) return;
    this.audio.loop = this.repeat && this.playlist?.tracks.length === 1;
    this.audio.src = track.audioUrl;
    this.audio.load();
    this.publish();
  }

  private publish(): void {
    if (this.disposed) return;
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private onLoadStart = (): void => {
    this.status = 'loading';
    this.publish();
  };
  private onMetadata = (): void => {
    if (this.status !== 'playing') this.status = 'paused';
    this.publish();
  };
  private onTimeUpdate = (): void => this.publish();
  private onPlaying = (): void => {
    this.status = 'playing';
    this.error = null;
    this.publish();
  };
  private onPause = (): void => {
    // Some browsers may deliver a queued pause event after a new play request.
    // Read the current media state so that stale events do not stop the round.
    if (!this.audio.paused) return;
    if (this.status !== 'error' && this.status !== 'ended') this.status = 'paused';
    this.publish();
  };
  private onEnded = (): void => {
    if (this.repeat && (this.playlist?.tracks.length ?? 0) > 1) {
      this.next();
      return;
    }
    this.status = 'ended';
    this.publish();
  };
  private onError = (): void => {
    this.status = 'error';
    this.error = 'This audio file could not be loaded. Try another track or check its URL.';
    this.publish();
  };
  private onWaiting = (): void => {
    if (this.status === 'playing') this.status = 'loading';
    this.publish();
  };
  private onCanPlay = (): void => {
    if (this.status === 'loading' && !this.audio.paused) this.status = 'playing';
    else if (this.status === 'loading') this.status = 'paused';
    this.publish();
  };
}
