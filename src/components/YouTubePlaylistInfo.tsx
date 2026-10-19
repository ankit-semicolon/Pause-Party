import { ArrowUpRight, Check, Link2, Video } from 'lucide-react';
import { useState } from 'react';
import type { YouTubePlaylistProvider } from '../services/music/YouTubePlaylistProvider';
import type { PlaybackSnapshot } from '../types/music';

export interface YouTubeMediaLink {
  type: 'playlist' | 'video';
  id: string;
}

export function parseYouTubeMediaLink(value: string): YouTubeMediaLink | null {
  try {
    const url = new URL(value.trim());
    const allowedHosts = ['youtube.com', 'www.youtube.com', 'music.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'];
    if (!allowedHosts.includes(url.hostname.toLowerCase())) return null;
    const playlistId = url.searchParams.get('list');
    const pathVideoId = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
    const videoId = url.hostname.toLowerCase().endsWith('youtu.be')
      ? url.pathname.split('/').filter(Boolean)[0] ?? null
      : url.searchParams.get('v') ?? pathVideoId;

    if (playlistId && /^[a-zA-Z0-9_-]{10,80}$/.test(playlistId) && (!videoId || url.pathname === '/playlist')) {
      return { type: 'playlist', id: playlistId };
    }
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) return { type: 'video', id: videoId };
    if (playlistId && /^[a-zA-Z0-9_-]{10,80}$/.test(playlistId)) return { type: 'playlist', id: playlistId };
    return null;
  } catch {
    return null;
  }
}

export function YouTubePlaylistInfo({ provider, playback }: {
  provider: YouTubePlaylistProvider;
  playback: PlaybackSnapshot;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const media = parseYouTubeMediaLink(value);
  const loaded = Boolean(media && provider.loadedMediaType === media.type && provider.loadedMediaId === media.id && playback.status !== 'error');
  const openUrl = media?.type === 'playlist'
    ? `https://music.youtube.com/playlist?list=${encodeURIComponent(media.id)}`
    : media ? `https://music.youtube.com/watch?v=${encodeURIComponent(media.id)}` : null;

  const loadMedia = async () => {
    if (!media) return;
    setBusy(true);
    setMessage(null);
    try {
      if (media.type === 'playlist') await provider.loadYouTubePlaylist(media.id);
      else await provider.loadYouTubeVideo(media.id);
      setMessage(`${media.type === 'playlist' ? 'Playlist' : 'Song'} cued. Press Start Game when everyone is ready.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'YouTube could not load this song or playlist.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="youtube-panel">
      <div className="youtube-brand"><span className="youtube-brand-mark"><Video size={18} /></span><span><strong>YouTube song or playlist</strong><small>Paste a link to either one</small></span></div>
      <label className="youtube-input-wrap" htmlFor="youtube-media"><Link2 size={16} /><input id="youtube-media" aria-label="Paste a YouTube song or playlist link" type="url" value={value} onChange={(event) => { setValue(event.target.value); setMessage(null); }} placeholder="Paste a song or playlist link" autoComplete="off" /></label>
      {value && !media && <p className="field-error">Paste a YouTube video/song link or a playlist link.</p>}
      {media && <div className="recognized-playlist"><span><span className="recognized-dot" />{media.type === 'playlist' ? 'Playlist' : 'Song'} link recognized</span>{openUrl && <a href={openUrl} target="_blank" rel="noreferrer">Open in YouTube Music <ArrowUpRight size={14} /></a>}</div>}
      {media && <button className="youtube-load-button" type="button" onClick={() => void loadMedia()} disabled={busy || loaded}>
        {loaded ? <><Check size={15} /> {media.type === 'playlist' ? 'Playlist' : 'Song'} cued</> : busy ? 'Loading…' : media.type === 'playlist' ? 'Load this playlist' : 'Load this song'}
      </button>}
      {(message || playback.error) && <p className={playback.status === 'error' ? 'field-error' : 'youtube-success'} role={playback.status === 'error' ? 'alert' : 'status'}>{playback.error ?? message}</p>}
      <p className="youtube-policy"><strong>Visible YouTube player required.</strong> YouTube plays the video with its own controls, branding, and ads. Selecting this source loads YouTube’s player and may share standard playback data with YouTube. The player stays on screen while the game runs; audio-only extraction and background play are not supported. Use the hosted HTTPS or localhost version; a directly opened HTML file cannot provide YouTube’s required page identity.</p>
      {loaded && <p className="youtube-helper">The game will pause and resume the visible YouTube player. Some videos may block embedding.</p>}
    </div>
  );
}
