import type { GameSnapshot, GameState, PauseBounds } from '../../types/game';
import type { MusicProvider, PlaybackSnapshot } from '../../types/music';
import { choosePauseDuration, normalizeBounds } from '../../utils/randomInterval';

type Listener = (snapshot: GameSnapshot) => void;
type RandomDuration = (bounds: PauseBounds) => number;

/**
 * Playback-progress-driven game state machine. Audio timeupdate events are
 * the clock: wall-clock timeouts never advance a round while audio is paused.
 */
export class GameEngine {
  private bounds: PauseBounds;
  private readonly listeners = new Set<Listener>();
  private unsubscribeProvider: (() => void) | null = null;
  private readonly randomDuration: RandomDuration;
  private state: GameState = 'IDLE';
  private activeSeconds = 0;
  private targetSeconds = 0;
  private round = 0;
  private message: string | null = null;
  private error: string | null = null;
  private lastPosition: number | null = null;
  private lastDuration: number | null = null;
  private lastTrackId: string | null = null;
  private providerWasPlaying = false;
  private destroyed = false;

  constructor(
    private readonly provider: MusicProvider,
    bounds: PauseBounds,
    randomDuration: RandomDuration = choosePauseDuration,
  ) {
    this.bounds = normalizeBounds(bounds);
    this.randomDuration = randomDuration;
  }

  getSnapshot(): GameSnapshot {
    return {
      state: this.state,
      activeSeconds: this.activeSeconds,
      targetSeconds: this.targetSeconds,
      round: this.round,
      message: this.message,
      error: this.error,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    if (!['IDLE', 'STOPPED', 'ERROR'].includes(this.state)) return;
    this.attachProvider();
    this.error = null;
    this.activeSeconds = 0;
    this.targetSeconds = this.randomDuration(this.bounds);
    this.round = 1;
    this.message = null;
    this.providerWasPlaying = false;
    this.state = 'READY';
    this.emit();
    await this.startAudio();
  }

  async resume(): Promise<void> {
    if (this.state !== 'PAUSED_FOR_GAME' && this.state !== 'PAUSED_BY_USER') return;
    this.error = null;
    this.targetSeconds = this.randomDuration(this.bounds);
    this.activeSeconds = 0;
    this.round += 1;
    this.message = null;
    this.providerWasPlaying = false;
    this.state = 'READY';
    this.emit();
    await this.startAudio();
  }

  async pauseByUser(): Promise<void> {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED_BY_USER';
    this.message = null;
    this.providerWasPlaying = false;
    this.emit();
    await this.provider.pause();
  }

  async stop(): Promise<void> {
    if (this.state === 'IDLE' || this.state === 'STOPPED') return;
    this.state = 'STOPPED';
    this.activeSeconds = 0;
    this.targetSeconds = 0;
    this.message = null;
    this.error = null;
    this.providerWasPlaying = false;
    this.resetProgressBaseline(this.provider.getSnapshot());
    this.detachProvider();
    this.emit();
    await this.provider.pause();
  }

  async restart(): Promise<void> {
    if (this.state === 'IDLE' || this.state === 'STOPPED') {
      await this.start();
      return;
    }
    await this.provider.pause();
    this.state = 'STOPPED';
    this.activeSeconds = 0;
    this.targetSeconds = 0;
    this.round = 0;
    this.providerWasPlaying = false;
    this.resetProgressBaseline(this.provider.getSnapshot());
    this.emit();
    await this.start();
  }

  updateBounds(bounds: PauseBounds): void {
    this.bounds = normalizeBounds(bounds);
    if (this.state === 'PLAYING') {
      // A settings edit starts a fresh, unpredictable window from this moment.
      this.targetSeconds = this.activeSeconds + this.randomDuration(this.bounds);
    }
    this.emit();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.deactivate();
    this.destroyed = true;
    this.listeners.clear();
  }

  activate(): void {
    if (this.destroyed) this.destroyed = false;
    this.attachProvider();
  }

  deactivate(): void {
    this.detachProvider();
  }

  private async startAudio(): Promise<void> {
    try {
      await this.provider.play();
      if (this.state !== 'READY') return;
      this.state = 'PLAYING';
      this.providerWasPlaying = true;
      this.resetProgressBaseline(this.provider.getSnapshot());
      this.emit();
    } catch (cause) {
      if (this.state !== 'READY') return;
      this.state = 'ERROR';
      this.error = cause instanceof Error ? cause.message : 'Audio playback could not start.';
      this.providerWasPlaying = false;
      this.emit();
    }
  }

  private attachProvider(): void {
    if (this.unsubscribeProvider) return;
    this.unsubscribeProvider = this.provider.subscribe((snapshot) => this.onPlayback(snapshot));
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibilityChange);
    if (typeof window !== 'undefined') window.addEventListener('pageshow', this.onPageShow);
  }

  private detachProvider(): void {
    this.unsubscribeProvider?.();
    this.unsubscribeProvider = null;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (typeof window !== 'undefined') window.removeEventListener('pageshow', this.onPageShow);
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') this.onPlayback(this.provider.getSnapshot());
  };

  private onPageShow = (): void => this.onPlayback(this.provider.getSnapshot());

  private onPlayback(snapshot: PlaybackSnapshot): void {
    if (this.destroyed) return;
    if (snapshot.status === 'error') {
      if (this.state !== 'STOPPED' && this.state !== 'IDLE') {
        this.state = 'ERROR';
        this.error = snapshot.error ?? 'Audio playback failed.';
        this.providerWasPlaying = false;
        this.emit();
      }
      return;
    }

    if (snapshot.status === 'playing') {
      if (this.state === 'PAUSED_FOR_GAME' || this.state === 'PAUSED_BY_USER' || this.state === 'STOPPED' || this.state === 'IDLE' || this.state === 'ERROR') {
        // If a provider or browser resumes independently, immediately restore
        // the user-requested pause. Only resume() can leave a pause state.
        void this.provider.pause();
        return;
      }
      if (this.state === 'PLAYING') {
        this.providerWasPlaying = true;
        this.accountProgress(snapshot);
      }
      return;
    }

    if (snapshot.status === 'paused' || snapshot.status === 'ended' || snapshot.status === 'idle') {
      if (this.state === 'PLAYING' && this.providerWasPlaying) {
        this.state = 'PAUSED_BY_USER';
        this.providerWasPlaying = false;
        this.message = snapshot.status === 'ended' ? 'That track ran out of road. Pick another or resume the party.' : null;
        this.emit();
      }
    }
  }

  private accountProgress(snapshot: PlaybackSnapshot): void {
    const trackId = snapshot.currentTrack?.id ?? null;
    if (this.lastPosition === null || trackId !== this.lastTrackId) {
      this.resetProgressBaseline(snapshot);
      return;
    }

    let delta = snapshot.currentTime - this.lastPosition;
    if (delta < 0) {
      // A single-track repeat wraps currentTime back to zero.
      if (this.lastDuration && this.lastPosition > this.lastDuration * 0.8 && snapshot.currentTime < this.lastDuration * 0.2) {
        delta = this.lastDuration - this.lastPosition + snapshot.currentTime;
      } else {
        delta = 0;
      }
    }
    this.lastPosition = snapshot.currentTime;
    this.lastDuration = snapshot.duration;

    if (delta > 0) {
      this.activeSeconds += delta;
      if (this.activeSeconds >= this.targetSeconds) {
        this.activeSeconds = this.targetSeconds;
        this.state = 'PAUSED_FOR_GAME';
        this.providerWasPlaying = false;
        this.emit();
        void this.provider.pause();
        return;
      }
      this.emit();
    }
  }

  private resetProgressBaseline(snapshot: PlaybackSnapshot): void {
    this.lastPosition = snapshot.currentTime;
    this.lastDuration = snapshot.duration;
    this.lastTrackId = snapshot.currentTrack?.id ?? null;
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
