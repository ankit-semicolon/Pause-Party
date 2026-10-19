import type { ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, CircleStop, Disc3, Pause, Play, RotateCcw, Shuffle, Volume2, VolumeX } from 'lucide-react';
import type { GameSnapshot } from '../types/game';
import type { PlaybackSnapshot } from '../types/music';
import { AudioVisualizer } from './AudioVisualizer';

const playingLines = [
  'Run like your snacks depend on it.',
  'The chair is not going to save itself.',
  'Pass the ball. Trust nobody.',
  'Someone is about to regret that victory dance.',
  'The DJ is thinking dangerous thoughts…',
];

export function GameStage({ game, playback, humor, suspensePulse, selectedMode, onStart, onPause, onResume, onStop, onRestart, onPrevious, onNext, onShuffle, shuffle, repeat, onRepeat, volume, onVolume, pauseLine, onPauseLineChange, canStart, mediaPlayer = null, startHint = 'Choose a soundtrack to play' }: {
  game: GameSnapshot;
  playback: PlaybackSnapshot;
  humor: boolean;
  suspensePulse: boolean;
  selectedMode: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRestart: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onShuffle: () => void;
  shuffle: boolean;
  repeat: boolean;
  onRepeat: () => void;
  volume: number;
  onVolume: (value: number) => void;
  pauseLine: string;
  onPauseLineChange: () => void;
  canStart: boolean;
  mediaPlayer?: ReactNode;
  startHint?: string;
}) {
  const pausedForGame = game.state === 'PAUSED_FOR_GAME';
  const manuallyPaused = game.state === 'PAUSED_BY_USER';
  const playing = game.state === 'PLAYING';
  const loading = game.state === 'READY';
  const playlistSize = playback.playlist?.tracks.length ?? 0;
  const canNavigateTracks = playlistSize > 1;
  const active = playing && playback.status === 'playing';
  const stageTitle = pausedForGame ? 'FREEZE!' : manuallyPaused ? 'Taking five?' : playing ? 'Keep it moving.' : loading ? 'Warming up the speakers…' : game.state === 'ERROR' ? 'The music hit a snag.' : 'Ready when you are.';
  const stageSubtitle = pausedForGame
    ? 'Music is paused. Your move decides when the next round starts.'
    : manuallyPaused ? 'You paused the music. Resume whenever the room is ready.'
      : playing ? (humor ? playingLines[(Math.max(game.round - 1, 0)) % playingLines.length] : `${selectedMode} · round ${game.round}`)
        : loading ? 'Loading your soundtrack…'
          : game.state === 'ERROR' ? (game.error ?? 'Check the selected audio and try again.')
            : 'The music plays. The stop is a surprise. You are the DJ.';

  return (
    <section className={`stage-card glass-card ${pausedForGame ? 'stage-frozen' : ''} ${pausedForGame && suspensePulse ? 'stage-suspense-pulse' : ''} ${playing ? 'stage-playing' : ''}`} aria-labelledby="stage-title">
      <div className="stage-topline"><span className={`status-chip ${playing ? 'status-live' : pausedForGame ? 'status-freeze' : ''}`}><i />{pausedForGame ? 'ROUND STOPPED' : playing ? 'LIVE ROUND' : manuallyPaused ? 'ON YOUR PAUSE' : game.state === 'ERROR' ? 'PLAYER ERROR' : loading ? 'STARTING' : 'STANDING BY'}</span><span className="round-count">{game.round > 0 ? `ROUND ${String(game.round).padStart(2, '0')}` : 'NO ROUND'}</span></div>
      {mediaPlayer}
      {!mediaPlayer && <AudioVisualizer active={active} />}
      <div className="stage-copy" aria-live="polite" aria-atomic="true">
        <div className="stage-kicker">{pausedForGame ? 'THE MUSIC JUST STOPPED' : manuallyPaused ? 'YOUR MUSIC, YOUR CALL' : playing ? 'DON’T STOP NOW' : 'YOUR DJ HAS TRUST ISSUES'}</div>
        <h2 id="stage-title" key={stageTitle}>{stageTitle}</h2>
        <p>{stageSubtitle}</p>
      </div>

      {pausedForGame && <div className="pause-note"><span className="freeze-spark">✳</span><span>{humor ? pauseLine : 'A new random round is waiting for you.'}</span><span className="freeze-spark">✳</span></div>}

      {game.state === 'ERROR' && <div className="stage-error" role="alert">{game.error ?? playback.error ?? 'Audio playback failed.'}</div>}

      <div className="stage-actions">
        {playing ? (
          <button className="primary-game-button pause-action" onClick={onPause} type="button"><Pause fill="currentColor" size={19} /> Pause music <span>your call</span></button>
        ) : pausedForGame ? (
          <button className="primary-game-button resume-action" onClick={onResume} type="button"><Play fill="currentColor" size={21} /> RESUME MUSIC <span>start round {game.round + 1}</span></button>
        ) : manuallyPaused ? (
          <button className="primary-game-button resume-action" onClick={onResume} type="button"><Play fill="currentColor" size={20} /> Resume music</button>
        ) : loading ? (
          <button className="primary-game-button start-action" disabled type="button"><span className="loading-dot" /> Starting…</button>
        ) : (
          <button className="primary-game-button start-action" onClick={onStart} type="button" disabled={!canStart}><Play fill="currentColor" size={20} /> {game.state === 'ERROR' ? 'Try again' : game.state === 'STOPPED' ? 'Start a new game' : 'Start Game'} <span>{canStart ? 'let the chaos begin' : startHint}</span></button>
        )}
      </div>

      <div className="stage-secondary-actions">
        {(playing || pausedForGame || manuallyPaused || game.state === 'ERROR') && <button className="quiet-button" type="button" onClick={onStop}><CircleStop size={16} /> Stop game</button>}
        {(playing || pausedForGame || manuallyPaused || game.state === 'ERROR') && <button className="quiet-button" type="button" onClick={() => { onPauseLineChange(); onRestart(); }}><RotateCcw size={15} /> Restart</button>}
        {(playing || pausedForGame || manuallyPaused) && <span className="stage-controls-spacer" />}
        {(playing || pausedForGame || manuallyPaused) && playlistSize > 1 && <button className={`icon-control ${shuffle ? 'is-on' : ''}`} type="button" onClick={onShuffle} aria-label={`Shuffle ${shuffle ? 'on' : 'off'}`} title="Shuffle"><Shuffle size={15} /></button>}
        {(playing || pausedForGame || manuallyPaused) && playlistSize > 0 && <button className={`icon-control ${repeat ? 'is-on' : ''}`} type="button" onClick={onRepeat} aria-label={`Repeat ${repeat ? 'on' : 'off'}`} title="Repeat"><RotateCcw size={15} /></button>}
      </div>

      <div className="now-playing">
        <span className="now-playing-art"><Disc3 size={20} /></span>
        <span className="now-playing-copy"><small>NOW PLAYING</small><strong>{playback.currentTrack?.title ?? 'Choose a soundtrack'}</strong><em>{playback.currentTrack?.artist ?? playback.playlist?.name ?? 'Your room is waiting'}</em></span>
        <button className="track-skip" type="button" onClick={onPrevious} disabled={!canNavigateTracks} aria-label="Previous track"><ArrowLeft size={16} /></button>
        <button className="track-skip" type="button" onClick={onNext} disabled={!canNavigateTracks} aria-label="Next track"><ArrowRight size={16} /></button>
      </div>

      <div className="volume-row"><span>{volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}</span><input aria-label="Music volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => onVolume(Number(event.target.value))} /><span className="volume-number">{Math.round(volume * 100)}%</span><a className="stage-scroll-link" href="#setup">Game setup <ArrowDown size={13} /></a></div>
    </section>
  );
}
