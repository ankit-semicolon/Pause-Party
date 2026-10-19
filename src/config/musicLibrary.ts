import type { MusicPlaylist } from '../types/music';

// Vite supplies the right prefix locally, in a custom domain, and on GitHub Pages.
const publicAsset = (path: string) => path.startsWith('data:')
  ? path
  : `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

/**
 * Add your own playlists here. The included example uses an original,
 * generated instrumental loop so the game works immediately after install.
 * See README.md for audio formats, local files, hosting, and cover art.
 */
export const MUSIC_LIBRARY: MusicPlaylist[] = [
  {
    id: 'party-starter',
    name: 'The Party Starter',
    description: 'An original little groove, made for questionable dance moves.',
    coverImage: publicAsset('art/party-starter.svg'),
    tracks: [
      {
        id: 'sugar-rush',
        title: 'Sugar Rush Shuffle',
        artist: 'Pause Party Sound Lab',
        audioUrl: publicAsset('audio/sugar-rush-shuffle.wav'),
        category: 'Original instrumental',
      },
    ],
  },
  // Add more entries by copying this shape:
  // {
  //   id: 'my-playlist',
  //   name: 'My Playlist',
  //   description: 'A short note about the vibe.',
  //   coverImage: '/art/my-cover.jpg',
  //   tracks: [
  //     { id: 'my-song', title: 'My Song', artist: 'Me', audioUrl: '/audio/my-song.mp3' },
  //   ],
  // },
];
