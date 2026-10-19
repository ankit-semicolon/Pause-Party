import { Check, Disc3, Music2 } from 'lucide-react';
import type { MusicPlaylist, PlaybackSnapshot } from '../types/music';
import { formatTime } from '../utils/formatTime';

export function MusicLibrary({ playlists, selectedId, playback, onSelectPlaylist, onSelectTrack }: {
  playlists: MusicPlaylist[];
  selectedId: string | null;
  playback: PlaybackSnapshot;
  onSelectPlaylist: (playlist: MusicPlaylist) => void;
  onSelectTrack: (trackId: string) => void;
}) {
  if (!playlists.length) {
    return <div className="empty-library"><span className="empty-icon"><Music2 size={22} /></span><strong>Your library is waiting for a soundtrack</strong><p>Add a playlist in <code>src/config/musicLibrary.ts</code> and its audio file under <code>public/audio</code>.</p></div>;
  }

  return (
    <div className="library-list">
      {playlists.map((playlist, index) => {
        const selected = playlist.id === selectedId;
        const active = selected && playback.status === 'playing';
        return (
          <button className={`playlist-card ${selected ? 'selected' : ''}`} type="button" key={playlist.id} onClick={() => onSelectPlaylist(playlist)} aria-pressed={selected}>
            <span className={`playlist-art playlist-art-${index % 3}`}>
              {playlist.coverImage ? <img src={playlist.coverImage} alt="" /> : <Disc3 size={29} />}
              {selected && <span className="playlist-check"><Check size={14} /></span>}
            </span>
            <span className="playlist-info"><strong>{playlist.name}</strong><small>{playlist.description ?? `${playlist.tracks.length} songs · Ready to shuffle`}</small></span>
            <span className={`playlist-play-state ${active ? 'playing' : ''}`} aria-hidden="true">{active ? <span className="mini-eq"><i /><i /><i /></span> : `${playlist.tracks.length} ${playlist.tracks.length === 1 ? 'track' : 'tracks'}`}</span>
          </button>
        );
      })}
      {playback.playlist?.id === selectedId && playback.currentTrack && (
        <div className="track-select">
          <div className="track-select-label"><span>IN THIS MIX</span><small>{playback.trackIndex + 1} / {playback.playlist.tracks.length}</small></div>
          {playback.playlist.tracks.map((track, index) => (
            <button className={`track-row ${track.id === playback.currentTrack?.id ? 'current' : ''}`} type="button" key={track.id} onClick={() => onSelectTrack(track.id)} aria-pressed={track.id === playback.currentTrack?.id}>
              <span className="track-number">{track.id === playback.currentTrack?.id ? <Music2 size={13} /> : String(index + 1).padStart(2, '0')}</span>
              <span className="track-title"><strong>{track.title}</strong><small>{track.artist ?? track.category ?? 'Your soundtrack'}</small></span>
              <span className="track-duration">{track.duration ? formatTime(track.duration) : '—'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
