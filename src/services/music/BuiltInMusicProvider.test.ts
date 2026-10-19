import { describe, expect, it, vi } from 'vitest';
import { BuiltInMusicProvider } from './BuiltInMusicProvider';
import type { MusicPlaylist } from '../../types/music';
import { DEFAULT_MUSIC_VOLUME } from '../../config/musicSettings';

const playlist: MusicPlaylist = {
  id: 'mix',
  name: 'Party mix',
  tracks: [
    { id: 'one', title: 'One', audioUrl: '/audio/one.mp3' },
    { id: 'two', title: 'Two', audioUrl: '/audio/two.ogg' },
  ],
};

class FakeAudio extends EventTarget {
  currentTime = 0;
  duration = 120;
  paused = true;
  loop = false;
  volume = 1;
  preload = '';
  src = '';
  playCalls = 0;
  load = vi.fn(() => this.dispatchEvent(new Event('loadstart')));
  removeAttribute(name: string) { if (name === 'src') this.src = ''; }
  async play() {
    this.playCalls += 1;
    this.paused = false;
    this.dispatchEvent(new Event('playing'));
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
}

describe('BuiltInMusicProvider', () => {
  it('loads a selected playlist without starting audio before the user action', () => {
    const audio = new FakeAudio();
    const provider = new BuiltInMusicProvider(audio as unknown as HTMLAudioElement);
    expect(audio.volume).toBe(DEFAULT_MUSIC_VOLUME);
    provider.loadPlaylist(playlist);
    expect(audio.src).toBe('/audio/one.mp3');
    expect(audio.playCalls).toBe(0);
    expect(provider.getSnapshot().currentTrack?.title).toBe('One');
    provider.dispose();
  });

  it('plays and pauses only when explicitly controlled', async () => {
    const audio = new FakeAudio();
    const provider = new BuiltInMusicProvider(audio as unknown as HTMLAudioElement);
    provider.loadPlaylist(playlist);
    await provider.play();
    expect(provider.getSnapshot().status).toBe('playing');
    expect(audio.playCalls).toBe(1);
    await provider.pause();
    expect(provider.getSnapshot().status).toBe('paused');
    expect(audio.paused).toBe(true);
    provider.dispose();
  });

  it('ignores an outdated pause event after audio has already resumed', async () => {
    const audio = new FakeAudio();
    const provider = new BuiltInMusicProvider(audio as unknown as HTMLAudioElement);
    provider.loadPlaylist(playlist);
    await provider.play();
    audio.dispatchEvent(new Event('pause'));
    expect(provider.getSnapshot().status).toBe('playing');
    provider.dispose();
  });

  it('switches tracks without auto-playing and reports unavailable audio', () => {
    const audio = new FakeAudio();
    const provider = new BuiltInMusicProvider(audio as unknown as HTMLAudioElement);
    provider.loadPlaylist(playlist);
    provider.selectTrack('two');
    expect(provider.getSnapshot().currentTrack?.title).toBe('Two');
    expect(audio.src).toBe('/audio/two.ogg');
    expect(audio.playCalls).toBe(0);
    audio.dispatchEvent(new Event('error'));
    expect(provider.getSnapshot()).toMatchObject({ status: 'error', error: expect.stringMatching(/could not be loaded/i) });
    provider.dispose();
  });

  it('rejects empty playlists with a useful message', () => {
    const provider = new BuiltInMusicProvider(new FakeAudio() as unknown as HTMLAudioElement);
    expect(() => provider.loadPlaylist({ ...playlist, tracks: [] })).toThrow(/no tracks/i);
    provider.dispose();
  });
});
