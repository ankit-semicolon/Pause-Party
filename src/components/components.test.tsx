import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameStage } from './GameStage';
import { MusicLibrary } from './MusicLibrary';
import { ThemeToggle } from './ThemeToggle';
import type { GameSnapshot } from '../types/game';
import type { PlaybackSnapshot } from '../types/music';

const playback: PlaybackSnapshot = { status: 'paused', currentTime: 0, duration: null, currentTrack: null, playlist: null, trackIndex: 0, error: null };
const game: GameSnapshot = { state: 'PAUSED_FOR_GAME', activeSeconds: 40, targetSeconds: 40, round: 2, message: null, error: null };

describe('core interface states', () => {
  it('keeps the manual resume action prominent after a game pause', () => {
    const resume = vi.fn();
    render(<GameStage game={game} playback={playback} humor suspensePulse selectedMode="Musical Chairs" onStart={vi.fn()} onPause={vi.fn()} onResume={resume} onStop={vi.fn()} onRestart={vi.fn()} onPrevious={vi.fn()} onNext={vi.fn()} onShuffle={vi.fn()} shuffle={false} repeat onRepeat={vi.fn()} volume={0.7} onVolume={vi.fn()} pauseLine="The silence is suspicious." onPauseLineChange={vi.fn()} canStart />);
    const button = screen.getByRole('button', { name: /resume music/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(resume).toHaveBeenCalledOnce();
  });

  it('does not expose a timer or progress bar while music plays', () => {
    const playingGame: GameSnapshot = { state: 'PLAYING', activeSeconds: 23, targetSeconds: 61, round: 1, message: null, error: null };
    render(<GameStage game={playingGame} playback={{ ...playback, status: 'playing' }} humor suspensePulse selectedMode="Musical Chairs" onStart={vi.fn()} onPause={vi.fn()} onResume={vi.fn()} onStop={vi.fn()} onRestart={vi.fn()} onPrevious={vi.fn()} onNext={vi.fn()} onShuffle={vi.fn()} shuffle={false} repeat onRepeat={vi.fn()} volume={0.7} onVolume={vi.fn()} pauseLine="The silence is suspicious." onPauseLineChange={vi.fn()} canStart />);
    expect(screen.getByRole('button', { name: /Pause music/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/round progress/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/played this round|remaining/i)).not.toBeInTheDocument();
  });

  it('shows a clear empty library message instead of pretending there are songs', () => {
    render(<MusicLibrary playlists={[]} selectedId={null} playback={playback} onSelectPlaylist={vi.fn()} onSelectTrack={vi.fn()} />);
    expect(screen.getByText(/your library is waiting for a soundtrack/i)).toBeInTheDocument();
    expect(screen.getByText(/src\/config\/musicLibrary\.ts/i)).toBeInTheDocument();
  });

  it('switches the accessible theme toggle label and calls its change handler', () => {
    const onChange = vi.fn();
    render(<ThemeToggle theme="dark" onChange={onChange} />);
    const button = screen.getByRole('button', { name: /switch to light mode/i });
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith('light');
  });

});
