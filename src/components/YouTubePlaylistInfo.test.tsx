import { describe, expect, it } from 'vitest';
import { parseYouTubeMediaLink } from './YouTubePlaylistInfo';

describe('parseYouTubeMediaLink', () => {
  it('recognizes YouTube Music and YouTube playlist links', () => {
    expect(parseYouTubeMediaLink('https://music.youtube.com/playlist?list=PLabcdefghij&si=share')).toEqual({ type: 'playlist', id: 'PLabcdefghij' });
    expect(parseYouTubeMediaLink('https://www.youtube.com/playlist?list=RDabcdefghij')).toEqual({ type: 'playlist', id: 'RDabcdefghij' });
  });

  it('recognizes individual YouTube and YouTube Music song links', () => {
    expect(parseYouTubeMediaLink('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ type: 'video', id: 'dQw4w9WgXcQ' });
    expect(parseYouTubeMediaLink('https://youtu.be/dQw4w9WgXcQ?t=14')).toEqual({ type: 'video', id: 'dQw4w9WgXcQ' });
    expect(parseYouTubeMediaLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghij')).toEqual({ type: 'video', id: 'dQw4w9WgXcQ' });
  });

  it('rejects non-YouTube hosts and links without a valid media ID', () => {
    expect(parseYouTubeMediaLink('https://example.com/playlist?list=PLabcdefghij')).toBeNull();
    expect(parseYouTubeMediaLink('https://music.youtube.com/playlist')).toBeNull();
    expect(parseYouTubeMediaLink('https://youtube.com/watch?v=short')).toBeNull();
  });
});
