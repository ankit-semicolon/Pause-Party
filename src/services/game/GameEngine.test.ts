import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from './GameEngine';
import type { MusicPlaylist, MusicProvider, PlaybackSnapshot } from '../../types/music';
import type { PauseBounds } from '../../types/game';

const playlist: MusicPlaylist = {
  id: 'test', name: 'Test Mix', tracks: [{ id: 'song', title: 'Test Song', audioUrl: '/test.wav' }],
};

class FakeProvider implements MusicProvider {
  snapshot: PlaybackSnapshot = { status: 'paused', currentTime: 0, duration: 100, currentTrack: playlist.tracks[0]!, playlist, trackIndex: 0, error: null };
  listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  playCalls = 0;
  pauseCalls = 0;
  failPlay = false;

  getSnapshot() { return this.snapshot; }
  subscribe(listener: (snapshot: PlaybackSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }
  loadPlaylist() {}
  selectTrack() {}
  async play() {
    this.playCalls += 1;
    if (this.failPlay) throw new Error('The browser blocked this audio.');
    this.snapshot = { ...this.snapshot, status: 'playing' };
    this.emit();
  }
  async pause() {
    this.pauseCalls += 1;
    this.snapshot = { ...this.snapshot, status: 'paused' };
    this.emit();
  }
  next() {}
  previous() {}
  setShuffle() {}
  setRepeat() {}
  setVolume() {}
  dispose() {}
  advance(seconds: number) {
    this.snapshot = { ...this.snapshot, currentTime: this.snapshot.currentTime + seconds };
    this.emit();
  }
  forcePlaying() {
    this.snapshot = { ...this.snapshot, status: 'playing' };
    this.emit();
  }
  emit() { this.listeners.forEach((listener) => listener(this.snapshot)); }
}

const exact = (seconds: number): PauseBounds => ({ minSeconds: seconds, maxSeconds: seconds });

describe('GameEngine', () => {
  it('does not attach playback listeners during render-time construction', async () => {
    const provider = new FakeProvider();
    const engine = new GameEngine(provider, exact(20), () => 20);
    expect(provider.listeners.size).toBe(0);
    await provider.play();
    expect(provider.pauseCalls).toBe(0);
    engine.destroy();
  });

  it('uses a fresh selected random interval for the first playback round', async () => {
    const provider = new FakeProvider();
    const draw = vi.fn(() => 31);
    const engine = new GameEngine(provider, { minSeconds: 20, maxSeconds: 75 }, draw);
    await engine.start();
    expect(draw).toHaveBeenCalledWith({ minSeconds: 20, maxSeconds: 75 });
    expect(engine.getSnapshot()).toMatchObject({ state: 'PLAYING', targetSeconds: 31, activeSeconds: 0, round: 1 });
    engine.destroy();
  });

  it('pauses the actual provider at the active playback threshold', async () => {
    const provider = new FakeProvider();
    const engine = new GameEngine(provider, exact(8), () => 8);
    await engine.start();
    provider.advance(4);
    expect(engine.getSnapshot()).toMatchObject({ state: 'PLAYING', activeSeconds: 4 });
    provider.advance(4);
    expect(engine.getSnapshot()).toMatchObject({ state: 'PAUSED_FOR_GAME', activeSeconds: 8 });
    expect(provider.pauseCalls).toBe(1);
    expect(provider.snapshot.status).toBe('paused');
    engine.destroy();
  });

  it('never resumes a game pause without a direct resume action', async () => {
    const provider = new FakeProvider();
    const engine = new GameEngine(provider, exact(5), () => 5);
    await engine.start();
    provider.advance(5);
    provider.forcePlaying();
    await Promise.resolve();
    expect(engine.getSnapshot().state).toBe('PAUSED_FOR_GAME');
    expect(provider.snapshot.status).toBe('paused');
    expect(provider.playCalls).toBe(1);
    engine.destroy();
  });

  it('starts a new random window only after manual resume', async () => {
    const provider = new FakeProvider();
    const draw = vi.fn().mockReturnValueOnce(9).mockReturnValueOnce(12);
    const engine = new GameEngine(provider, { minSeconds: 5, maxSeconds: 15 }, draw);
    await engine.start();
    provider.advance(9);
    expect(engine.getSnapshot().state).toBe('PAUSED_FOR_GAME');
    await engine.resume();
    expect(engine.getSnapshot()).toMatchObject({ state: 'PLAYING', targetSeconds: 12, activeSeconds: 0, round: 2 });
    expect(provider.playCalls).toBe(2);
    engine.destroy();
  });

  it('does not convert a manual user pause into a game pause', async () => {
    const provider = new FakeProvider();
    const engine = new GameEngine(provider, exact(20), () => 20);
    await engine.start();
    provider.advance(3);
    await engine.pauseByUser();
    expect(engine.getSnapshot()).toMatchObject({ state: 'PAUSED_BY_USER', activeSeconds: 3 });
    provider.advance(30);
    expect(engine.getSnapshot().state).toBe('PAUSED_BY_USER');
    expect(provider.pauseCalls).toBe(1);
    engine.destroy();
  });

  it('detaches playback listeners on stop and restarts without duplicate listeners', async () => {
    const provider = new FakeProvider();
    const engine = new GameEngine(provider, exact(20), () => 20);
    await engine.start();
    expect(provider.listeners.size).toBe(1);
    await engine.stop();
    expect(engine.getSnapshot().state).toBe('STOPPED');
    expect(provider.listeners.size).toBe(0);
    await engine.start();
    expect(provider.listeners.size).toBe(1);
    engine.destroy();
    expect(provider.listeners.size).toBe(0);
  });

  it('ignores duplicate starts while the first playback request is pending', async () => {
    const provider = new FakeProvider();
    let resolvePlay: (() => void) | undefined;
    provider.play = vi.fn(() => new Promise<void>((resolve) => { resolvePlay = () => { provider.snapshot = { ...provider.snapshot, status: 'playing' }; provider.emit(); resolve(); }; }));
    const engine = new GameEngine(provider, exact(20), () => 20);
    const first = engine.start();
    const second = engine.start();
    expect(provider.play).toHaveBeenCalledTimes(1);
    resolvePlay?.();
    await Promise.all([first, second]);
    expect(engine.getSnapshot().state).toBe('PLAYING');
    engine.destroy();
  });

  it('turns a rejected playback request into a clear error state', async () => {
    const provider = new FakeProvider();
    provider.failPlay = true;
    const engine = new GameEngine(provider, exact(20), () => 20);
    await engine.start();
    expect(engine.getSnapshot()).toMatchObject({ state: 'ERROR', error: 'The browser blocked this audio.' });
    engine.destroy();
  });

  it('applies new valid timing bounds to the current round from the edit', async () => {
    const provider = new FakeProvider();
    const draw = vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(7);
    const engine = new GameEngine(provider, exact(20), draw);
    await engine.start();
    provider.advance(4);
    engine.updateBounds(exact(7));
    expect(engine.getSnapshot()).toMatchObject({ state: 'PLAYING', activeSeconds: 4, targetSeconds: 11 });
    engine.destroy();
  });
});
